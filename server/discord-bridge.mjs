import {randomBytes} from 'node:crypto';
export function createDiscordBridge({pageOrigin,enabled=false,mintToken,now=Date.now}){
 let origin='';
 if(pageOrigin){const u=new URL(pageOrigin);if(u.origin!==pageOrigin.replace(/\/$/,'')||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw Error('PAGES_ORIGIN must be an HTTPS origin without a path.');origin=u.origin;}
 const flows=new Map(),ready=!!origin&&enabled;
 const prune=()=>{for(const [state,f]of flows)if(f.expires<=now())flows.delete(state);};
 function remember(state,channel){prune();if(!ready)throw Object.assign(new Error('Discord needs a configured Firebase callback backend.'),{status:503});if(!/^[a-zA-Z0-9_-]{32,128}$/.test(channel||''))throw Object.assign(new Error('Invalid sign-in channel.'),{status:400});if(flows.size>=1000)throw Object.assign(new Error('Sign-in is busy.'),{status:503});flows.set(state,{channel,expires:now()+600000});}
 function take(state){prune();const f=flows.get(state);flows.delete(state);return f||null;}
 async function token(subject){if(!/^\d{10,25}$/.test(subject||''))throw Error('Invalid Discord identity.');return mintToken('discord:'+subject);}
 function respond(res,flow,{token,error}={}){
  const nonce=randomBytes(18).toString('base64url');
  const payload=JSON.stringify({type:'vexel.discord.login',channel:flow.channel,...(token?{token}:{error:'Sign-in did not complete. Please try again.'})}).replace(/</g,'\\u003c');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-ancestors 'none'`});
  res.end(`<!doctype html><meta charset="utf-8"><title>Vexel sign-in</title><style>body{background:#071122;color:#dce8ff;font:16px system-ui;display:grid;place-items:center;min-height:90vh}main{padding:32px;border:1px solid #6981af55;border-radius:18px;background:#12224299;max-width:420px;text-align:center}</style><main><h1>Vexel</h1><p>${token?'Sign-in completed. You can close this window.':'Sign-in did not complete. Close this window and try again.'}</p></main><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${payload},${JSON.stringify(origin)});window.close();}</script>`);
 }
 return {ready,remember,take,token,respond};
}
let admin;
export async function mintFirebaseToken(uid){
 if(!admin)admin=(async()=>{const {initializeApp,applicationDefault}=await import('firebase-admin/app');const {getAuth}=await import('firebase-admin/auth');return getAuth(initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID},'vexel-discord'));})();
 return (await admin).createCustomToken(uid);
}
