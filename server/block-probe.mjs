import {parse} from 'parse5';
import {lookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import ipaddr from 'ipaddr.js';
import {classifyBlockEvidence} from '../public/block-signatures.js';
const MAX_BYTES=256*1024;
export function htmlBlockEvidence(html) {
 const tree=parse(String(html).slice(0,MAX_BYTES));let title='';const headings=[],lines=[],branding=[];
 const skip=node=>{
  const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  return ['script','style','noscript','template','svg'].includes(node.tagName)||'hidden'in attrs||attrs['aria-hidden']==='true'||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attrs.style||'')||/(?:^|\s)(?:hidden|d-none|sr-only|visually-hidden)(?:\s|$)/.test(attrs.class||'');
 };
 const textOf=node=>skip(node)?'':(node.childNodes||[]).map(c=>c.nodeName==='#text'?c.value:textOf(c)).join(' ');
 function walk(node){
  const tag=node.tagName,attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  if(skip(node))return;
  if(tag==='title'){title=textOf(node);return;}
  if(/^h[1-3]$/.test(tag||'')||attrs.role==='heading')headings.push(textOf(node));
  if(tag==='img')branding.push(attrs.alt||'',attrs.src||'');
  if(node.nodeName==='#text')lines.push(node.value);
  for(const child of node.childNodes||[])walk(child);
  if(['div','p','section','main','h1','h2','h3','br'].includes(tag))lines.push('\n');
 }
 walk(tree);return {title,headings,text:lines.join(' '),branding:branding.join(' ')};
}
export const classifyBlockHtml=html=>classifyBlockEvidence(htmlBlockEvidence(html));
export function isPublicAddress(value){try{let ip=ipaddr.parse(value);if(ip.kind()==='ipv6'&&ip.isIPv4MappedAddress())ip=ip.toIPv4Address();return ip.range()==='unicast';}catch{return false;}}
async function timedLookup(resolveHost,hostname,deadline){
 let timer;try{return await Promise.race([resolveHost(hostname,{all:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS lookup timed out')),Math.max(1,deadline-Date.now()));timer.unref?.();})]);}finally{clearTimeout(timer);}
}
export async function inspectExternalPage(raw,{resolveHost=lookup}={}){
 const deadline=Date.now()+8000;let url;try{url=new URL(raw);}catch{return {blocked:false,signature:null,inspection:'unavailable'};}
 try{
  for(let redirects=0;redirects<=3;redirects++){
   if(url.protocol!=='https:'||(url.port&&url.port!=='443')||url.username||url.password)throw Error('Unsupported source URL');
   const hostname=url.hostname.replace(/^\[|\]$/g,'');
   const addresses=ipaddr.isValid(hostname)?[{address:hostname,family:ipaddr.parse(hostname).kind()==='ipv6'?6:4}]:await timedLookup(resolveHost,hostname,deadline);
   if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw Error('Non-public destination');
   const remaining=deadline-Date.now();if(remaining<=0)throw Error('Probe timed out');
   const page=await new Promise((resolve,reject)=>{
    const selected=addresses[0];
    const req=httpsRequest(url,{method:'GET',headers:{Accept:'text/html,application/xhtml+xml,text/plain;q=0.8','Accept-Encoding':'identity','User-Agent':'Vexel-Game-Availability/0.4'},lookup:(_h,options,cb)=>options.all?cb(null,[selected]):cb(null,selected.address,selected.family),signal:AbortSignal.timeout(remaining)},res=>{
     const location=res.headers.location;
     if([301,302,303,307,308].includes(res.statusCode)&&location){res.destroy();resolve({redirect:new URL(location,url)});return;}
     if(!/^(?:text\/(?:html|plain)|application\/xhtml\+xml)(?:;|$)/i.test(res.headers['content-type']||'')||!['', 'identity'].includes(res.headers['content-encoding']||'')){res.destroy();resolve({unknown:true});return;}
     const chunks=[];let size=0,done=false;const finish=()=>{if(done)return;done=true;resolve({html:Buffer.concat(chunks).toString('utf8')});};
     res.on('data',chunk=>{const take=chunk.subarray(0,MAX_BYTES-size);chunks.push(take);size+=take.length;if(size>=MAX_BYTES){finish();res.destroy();}});res.on('end',finish);res.on('error',error=>{if(!done)reject(error);});
    });req.setTimeout(Math.min(4000,remaining),()=>req.destroy(Error('Source timed out')));req.on('error',reject);req.end();
   });
   if(page.redirect){url=page.redirect;continue;}
   if(page.unknown)return {blocked:false,signature:null,inspection:'unreadable'};
   return {...classifyBlockHtml(page.html),inspection:'response'};
  }
 }catch{}
 return {blocked:false,signature:null,inspection:'unavailable'};
}
const cache=new Map();
export function probeExternalGame(url){
 const existing=cache.get(url);if(existing&&existing.until>Date.now())return existing.promise;
 if(cache.size>=128)cache.delete(cache.keys().next().value);
 const entry={until:Date.now()+30000,promise:null};entry.promise=inspectExternalPage(url).then(result=>{entry.until=Date.now()+(result.blocked?15000:30000);return result;});cache.set(url,entry);return entry.promise;
}
