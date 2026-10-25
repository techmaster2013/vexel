import {firebaseConfig} from './editor-config.js';
export async function loadEdits(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
 try{
  const r=await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/vexel/site`,{signal:controller.signal});
  if(!r.ok)return null;
  const doc=await r.json();return validateEdits(JSON.parse(doc.fields.payload.stringValue));
 }catch{return null;}finally{clearTimeout(timer);}
}
export function validateEdits(data){
 if(!data||!Array.isArray(data.games)||!Array.isArray(data.movies)||data.games.length>200||data.movies.length>200)throw Error('Keep each list under 200 entries.');
 const https=value=>{if(!value)return '';const u=new URL(value);if(u.protocol!=='https:')throw Error('Use an https:// address.');return u.href;};
 const text=(v,max=200)=>String(v||'').trim().slice(0,max);
 return {games:data.games.map((g,i)=>({id:'editor-game-'+i,title:text(g.title),category:'Community',description:text(g.description,1000),launchUrl:https(g.url||g.launchUrl),status:'External',source:'Vexel editor'})).filter(g=>g.title&&g.launchUrl),movies:data.movies.map((m,i)=>({id:'editor-movie-'+i,title:text(m.title),year:text(m.year,10),description:text(m.description,1000),stream:https(m.url||m.stream),source:https(m.url||m.stream),color:'#182d50',license:'Added by site administrator'})).filter(m=>m.title&&m.stream),wispUrl:(()=>{if(!data.wispUrl)return '';const u=new URL(data.wispUrl);if(u.protocol!=='wss:')throw Error('Wisp needs a wss:// address.');return u.href;})()};
}
