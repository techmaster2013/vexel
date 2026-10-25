import site from './site-config.js';
export const staticMode=site.mode==='static';
export const asset=path=>new URL(path.replace(/^\//,''),import.meta.url).href;
export function gameAsset(path){return path.startsWith('/content/')?asset(path):path;}
let firebaseClient;
async function firebase(){
 if(!site.firebase?.apiKey||!site.firebase?.projectId)throw Error('Account setup is pending. The site owner needs to connect Firebase.');
 if(!firebaseClient)firebaseClient=import('./firebase-client.js').then(m=>m.createClient(site.firebase));
 return firebaseClient;
}
export async function providerSignIn(name){const client=await firebase();return client.provider(name);}
export async function api(path,data,{signal}={}){
 if(!staticMode){
  const r=await fetch(asset('api/'+path),{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal});
  const b=await r.json().catch(()=>{throw Error('Server unavailable.');});if(!r.ok)throw Error(b.error||'Request failed.');return b;
 }
 switch(path){
  case 'config':return {version:'0.5.0',staticMode:true,providers:{google:!!site.firebase&&site.firebaseProviders?.google,microsoft:!!site.firebase&&site.firebaseProviders?.microsoft,discord:false},proxyReady:!!site.wispUrl,gameOrigin:asset('content').replace(/\/$/,''),shop:[{id:'aurora',name:'Deep navy',price:40,color:'#203a68'},{id:'ember',name:'Slate',price:60,color:'#596c8b'},{id:'rose',name:'Midnight',price:80,color:'#101b30'}]};
  case 'catalog':{const r=await fetch(asset('content/manifest.json'));if(!r.ok)throw Error('Game catalog unavailable.');return r.json();}
  case 'proxy-config':return {wisp:site.wispUrl||''};
  case 'vm-config':return {ready:true};
  case 'me':return {user:site.firebase?await (await firebase()).me():null};
  case 'login':return {user:await(await firebase()).login(data.identifier,data.password)};
  case 'register':return {user:await(await firebase()).register(data)};
  case 'logout':if(site.firebase)await(await firebase()).logout();return {ok:true};
  case 'preferences':return {local:true};
  case 'activity':return {earned:0,user:site.firebase?await(await firebase()).me():null};
  case 'game-probe':return {blocked:false,signature:null,inspection:'unavailable'};
  default:throw Error('This feature needs a shared backend. Local games, appearance and tools work without one.');
 }
}
