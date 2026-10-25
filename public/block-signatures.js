// Conservative text signatures, shared by the server probe and readable frames.
// HTTP status, blank documents, onerror and iframe access failures are not evidence.
const normalize = value => String(value||'').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const contentBlocked = /^content\s+(?:is\s+|has\s+been\s+)?blocked[.!:]?$/;
const blockHeading = /^(?:(?:this\s+)?(?:web\s*page|website|site|url|content)(?:\s+access)?\s+(?:is\s+|has\s+been\s+)?blocked|access\s+(?:is\s+)?denied|web\s*filter\s+violation|blocked\s+(?:page|website|site|url))[.!]?$/;
const vendors = [
 ['goguardian',/\bgoguardian\b/],['securly',/\bsecurly\b/],
 ['lightspeed',/\blightspeed\s*(?:systems|filter)|\brelay\s+filter\b/],
 ['iboss',/\biboss\b/],['fortiguard',/\bfortiguard\b|\bfortinet\s+web\s*filter\b/],
 ['umbrella',/\bcisco\s+umbrella\b|\bopendns\b/],['zscaler',/\bzscaler\b/]
];
export function classifyBlockEvidence({title='',headings=[],text='',branding=''}={}) {
 const names=[title,...headings].map(normalize).filter(Boolean),body=normalize(text);
 if(names.some(x=>contentBlocked.test(x)))return {blocked:true,signature:'content-blocked-heading'};
 // A sparse page with a standalone banner qualifies; a mention inside game/help text does not.
 const lines=String(text).split(/[\r\n]+/).map(normalize).filter(Boolean);
 if(body.length<=800&&headings.length===0&&lines.slice(0,3).some(x=>contentBlocked.test(x)))return {blocked:true,signature:'content-blocked-banner'};
 const denial=names.some(x=>blockHeading.test(x));
 const policy=/\b(?:policy|administrator|web\s*filter|network\s*filter|school|organization|blocked\s+category|category\s+blocked)\b/.test(body);
 if(denial&&policy){
  const brand=normalize(branding+' '+text),vendor=vendors.find(([,pattern])=>pattern.test(brand));
  if(vendor)return {blocked:true,signature:vendor[0]+'-filter-denial'};
  // Require explicit block wording as well as policy context; generic access-denied pages stay unknown.
  if(names.some(x=>/\bblocked\b/.test(x)))return {blocked:true,signature:'policy-block-heading'};
 }
 return {blocked:false,signature:null};
}
export function readableDocumentEvidence(doc) {
 const visible=el=>!el.closest('[hidden],[aria-hidden="true"]')&&el.getClientRects().length>0;
 return {title:doc.title,headings:[...doc.querySelectorAll('h1,h2,h3,[role="heading"]')].filter(visible).map(el=>el.innerText||''),text:doc.body?.innerText||'',branding:[...doc.querySelectorAll('img[alt]')].filter(visible).map(el=>el.alt).join(' ')};
}
