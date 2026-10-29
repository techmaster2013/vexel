// Sandboxed games have opaque origins. Supply per-frame memory storage when browser
// storage is unavailable; never grant a game access to Vexel's account/preferences.
(()=>{for(const name of ['localStorage','sessionStorage']){try{window[name].getItem('__vexel_probe__');}catch{const data=new Map();Object.defineProperty(window,name,{value:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear()}});}}})();
