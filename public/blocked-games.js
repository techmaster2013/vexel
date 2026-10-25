import {api,staticMode} from "./runtime.js";
import {classifyBlockEvidence,readableDocumentEvidence} from './block-signatures.js';
export function renderBlockedFallback(container,{originalUrl,onOpenCaver}) {
 const panel=document.createElement('section');panel.className='blocked-fallback panel';panel.setAttribute('role','status');
 const icon=document.createElement('div');icon.className='blocked-symbol';icon.setAttribute('aria-hidden','true');icon.textContent='↗';
 const heading=document.createElement('h2');heading.textContent='Looks like this page was blocked.';
 const button=document.createElement('button');button.className='primary';button.type='button';button.textContent='Open in Caver';button.onclick=()=>onOpenCaver(originalUrl);
 panel.append(icon,heading,button);container.replaceChildren(panel);return panel;
}
export function watchExternalGame({frame,container,originalUrl,gameId,onOpenCaver,probe}){
 let disposed=false,confirmed=false,requested=false;const abort=new AbortController();
 const show=()=>{if(disposed||confirmed)return;confirmed=true;frame.remove();renderBlockedFallback(container,{originalUrl,onOpenCaver});};
 const inspectReadable=()=>{try{const doc=frame.contentDocument;if(doc&&classifyBlockEvidence(readableDocumentEvidence(doc)).blocked)show();}catch{/* Cross-origin frames are intentionally unreadable. */}};
 const check=async()=>{
  if(disposed||confirmed)return;inspectReadable();if(confirmed||requested||staticMode)return;requested=true;
  try{const result=probe?await probe():await api('game-probe?id='+encodeURIComponent(gameId),undefined,{signal:abort.signal});if(result?.blocked===true&&result?.signature)show();}catch{/* Failures are not block-page evidence. */}
 };
 frame.addEventListener('load',check);const timer=setTimeout(check,1200);
 return()=>{disposed=true;clearTimeout(timer);abort.abort();frame.removeEventListener('load',check);};
}
