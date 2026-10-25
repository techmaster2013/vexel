import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {firebaseConfig,usernames} from './editor-config.js';
import {validateEdits} from './content-store.js';
const app=initializeApp(firebaseConfig,'vexel-editor'),auth=getAuth(app),db=getFirestore(app),ref=doc(db,'vexel','site'),$=id=>document.getElementById(id);
const message=(text,error=false)=>{$('status').textContent=text;$('status').className=error?'error':'';};
function row(kind,item={}){
 const el=document.createElement('div');el.className='editor-entry';
 for(const [key,label] of [['title','Title'],['url',kind==='games'?'Game URL':'Video URL'],['description','Description']]){
 const l=document.createElement('label'),input=document.createElement('input');l.textContent=label;input.name=key;input.value=item[key]||item[key==='url'?(kind==='games'?'launchUrl':'stream'):key]||'';if(key==='url')input.type='url';l.append(input);el.append(l);
 }
 const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=()=>el.remove();el.append(remove);$(kind).append(el);
}
$('login-form').onsubmit=async e=>{e.preventDefault();message('Signing in…');try{let identifier=$('username').value.trim();identifier=usernames[identifier.toLowerCase()]||identifier;if(!identifier.includes('@'))throw Error('Use your existing GamePlaza admin email. A username alias can be added in editor-config.js.');await signInWithEmailAndPassword(auth,identifier,$('password').value);$('password').value='';}catch(e){message(['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(e.code)?'Incorrect login!':e.message,true);}};
onAuthStateChanged(auth,async user=>{
 $('editor').hidden=true;$('login').hidden=!!user;if(!user)return;
 try{const token=await user.getIdTokenResult(true);if(token.claims.vexelAdmin!==true)throw Error('Signed in, but this account needs Vexel editor permission. See the setup guide.');
 const snapshot=await getDoc(ref);const data=snapshot.exists()?validateEdits(JSON.parse(snapshot.data().payload)):{games:[],movies:[],wispUrl:''};
 $('games').replaceChildren();$('movies').replaceChildren();for(const kind of ['games','movies'])data[kind].forEach(item=>row(kind,item));$('wisp').value=data.wispUrl;$('editor').hidden=false;message('Ready to edit.');
 }catch(e){message(e.message,true);$('login').hidden=false;await signOut(auth);}
});
for(const [button,kind] of [['add-game','games'],['add-movie','movies']])$(button).onclick=()=>row(kind);
$('logout').onclick=()=>signOut(auth);
$('publish').onclick=async()=>{
 $('publish').disabled=true;try{
 const read=kind=>[...$(kind).children].map(el=>Object.fromEntries([...el.querySelectorAll('input')].map(input=>[input.name,input.value])));
 const data=validateEdits({games:read('games'),movies:read('movies'),wispUrl:$('wisp').value.trim()});
 const payload=JSON.stringify(data);if(payload.length>150000)throw Error('The list is too large.');
 await setDoc(ref,{payload,updatedAt:serverTimestamp()});message('Published. Reload Vexel to see your changes.');
 }catch(e){message('Could not publish: '+e.message,true);}finally{$('publish').disabled=false;}
};
