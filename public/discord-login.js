export function isDiscordMessage(event,{origin,popup,channel}){return event.origin===origin&&event.source===popup&&event.data?.type==='vexel.discord.login'&&event.data?.channel===channel;}
export function discordSignIn({backend,signInWithToken}){
 const base=new URL(backend);
 if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname)))throw Error('Discord needs an HTTPS callback backend.');
 const channel=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const url=new URL('/auth/discord',base);url.search=new URLSearchParams({client:'pages',channel});
 const popup=window.open(url.href,'vexel-discord','popup,width=520,height=740');
 if(!popup)throw Error('Allow the sign-in popup, then try again.');
 return new Promise((resolve,reject)=>{
  let finished=false;
  const cleanup=()=>{clearTimeout(timeout);clearInterval(closed);window.removeEventListener('message',message);};
  const fail=error=>{if(finished)return;finished=true;cleanup();popup.close();reject(error);};
  const message=async event=>{
   if(finished||!isDiscordMessage(event,{origin:base.origin,popup,channel}))return;
   if(event.data.error||typeof event.data.token!=='string')return fail(Error('Sign-in did not complete. Please try again.'));
   finished=true;cleanup();popup.close();try{resolve(await signInWithToken(event.data.token));}catch(e){reject(e);}
  };
  const timeout=setTimeout(()=>fail(Error('Sign-in expired. Please try again.')),300000);
  const closed=setInterval(()=>{if(popup.closed)fail(Error('Sign-in was cancelled. Please try again.'));},500);
  window.addEventListener('message',message);
 });
}
