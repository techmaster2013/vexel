import {friendlyAuthError} from "./auth-errors.js";
import {loginEmail,usernameLoginEmail,isUsernameEmail} from "./login-identifier.js";
// Loaded only when a real Firebase project has been configured.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithPopup,GoogleAuthProvider,OAuthProvider,signInWithEmailAndPassword,signInWithCustomToken,createUserWithEmailAndPassword,updateProfile,signOut,getIdTokenResult,connectAuthEmulator} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
// Same account as the GamePlaza editor; it may also hold the vexelAdmin claim.
const OWNER_UID='PeDivPz9H3hvwW0TB33tgq6V4u63';
const PRICES={aurora:40,ember:60,rose:80};
export async function createClient(config){
 const app=initializeApp(config),auth=getAuth(app);
 if(config.emulatorHost)connectAuthEmulator(auth,'http://'+config.emulatorHost+':9099',{disableWarnings:true});
 await new Promise(resolve=>{const stop=onAuthStateChanged(auth,()=>{stop();resolve();});});
 // Firestore (chat, coins, owned themes) loads only once someone is signed in.
 let store;
 const db=()=>store??=import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js').then(fs=>{const d=fs.getFirestore(app);if(config.emulatorHost)fs.connectFirestoreEmulator(d,config.emulatorHost,8080);return {fs,d};});
 const nameOf=u=>(u.displayName||u.email?.split('@')[0]||'player').slice(0,40);
 // The profile is read once and cached; balances are re-read only where they matter.
 let cached;
 async function profile(u,fresh=false){
  if(!fresh&&cached?.uid===u.uid)return cached;
  const {fs,d}=await db(),ref=fs.doc(d,'vexelUsers',u.uid);
  let snap=await fs.getDoc(ref);
  if(!snap.exists()){
   await fs.setDoc(ref,{username:nameOf(u),coins:0,owned:[],lastEarn:fs.serverTimestamp(),lastChat:fs.serverTimestamp()});
   snap=await fs.getDoc(ref);
  }
  return cached={uid:u.uid,ref,data:snap.data()};
 }
 const me=async()=>{
  const u=auth.currentUser;if(!u)return null;
  const {claims}=await getIdTokenResult(u);
  let p={};try{p=(await profile(u,true)).data;}catch(e){console.warn('[vexel] profile unavailable',e);}
  return {id:u.uid,username:p.username||nameOf(u),email:isUsernameEmail(u.email)?null:u.email,coins:p.coins||0,unlimitedCoins:claims.unlimitedCoins===true,admin:claims.admin===true||claims.vexelAdmin===true||u.uid===OWNER_UID,owned:p.owned||[],preferences:{}};
 };
 const signedIn=()=>{const u=auth.currentUser;if(!u)throw Object.assign(Error('Sign in first.'),{status:401});return u;};
 const denied=e=>e?.code==='permission-denied';
 async function run(fn){try{await fn();return me();}catch(e){throw friendlyAuthError(e);}}
 // A fresh token carries the new display name, which the chat rules check.
 const named=async(user,name)=>{await updateProfile(user,{displayName:name});await user.getIdToken(true);};
 return {me,
  customToken:token=>run(async()=>{const result=await signInWithCustomToken(auth,token);if(!result.user.displayName)await named(result.user,"discord_"+result.user.uid.split(":").pop().slice(-6));}),
  provider:name=>run(()=>{const p=name==='google'?new GoogleAuthProvider():name==='microsoft'?new OAuthProvider('microsoft.com'):null;if(!p)throw Error('Provider requires a backend callback.');return signInWithPopup(auth,p);}),
  login:(identifier,password)=>{let email;try{email=loginEmail(identifier);}catch{throw Object.assign(new Error("Incorrect login!"),{code:"auth/invalid-identifier",status:401});}return run(()=>signInWithEmailAndPassword(auth,email,password));},
  register:({username,email,password})=>run(async()=>{const address=email?loginEmail(email):usernameLoginEmail(username);const {user}=await createUserWithEmailAndPassword(auth,address,password);await named(user,username);}),
  logout:()=>signOut(auth),
  // 1 coin a minute while browsing, 3 while playing. The rules reject anything faster.
  async earn(kind){
   const u=signedIn(),{fs}=await db(),{ref}=await profile(u),amount=kind==='play'?3:1;
   try{await fs.updateDoc(ref,{coins:fs.increment(amount),lastEarn:fs.serverTimestamp()});return amount;}catch(e){if(denied(e))return 0;throw e;}
  },
  async buy(item){
   if(!(item in PRICES))throw Error('Unknown item.');
   const u=signedIn(),{fs}=await db(),{ref,data}=await profile(u,true),{claims}=await getIdTokenResult(u),free=claims.unlimitedCoins===true;
   if(data.owned.includes(item))throw Error('Already owned.');
   if(!free&&data.coins<PRICES[item])throw Error('Earn more coins to unlock this.');
   await fs.updateDoc(ref,{coins:fs.increment(free?0:-PRICES[item]),owned:fs.arrayUnion(item)});
  },
  async grant(username,amount){
   const {fs,d}=await db(),found=await fs.getDocs(fs.query(fs.collection(d,'vexelUsers'),fs.where('username','==',username),fs.limit(1)));
   if(found.empty)throw Object.assign(Error('User not found.'),{status:404});
   await fs.updateDoc(found.docs[0].ref,{coins:fs.increment(amount)});
  },
  // Live chat: one listener per open room; Firestore sends only new messages.
  async chatFeed(room,onMessages,onError){
   signedIn();const {fs,d}=await db();
   const q=fs.query(fs.collection(d,'chatRooms',room,'messages'),fs.orderBy('created','desc'),fs.limit(60));
   const failed=e=>onError(denied(e)?Error('Chat is still being set up. Try again later.'):e);
   return fs.onSnapshot(q,snap=>onMessages(snap.docs.map(m=>{const x=m.data({serverTimestamps:'estimate'});return {id:m.id,uid:x.uid,username:x.username,text:x.text,created:x.created?.toMillis?.()||Date.now()};}).reverse()),failed);
  },
  async send(room,text){
   const u=signedIn(),{fs,d}=await db(),{ref,data}=await profile(u),batch=fs.writeBatch(d);
   batch.set(fs.doc(fs.collection(d,'chatRooms',room,'messages')),{uid:u.uid,username:data.username,text,created:fs.serverTimestamp()});
   batch.update(ref,{lastChat:fs.serverTimestamp()});
   try{await batch.commit();}catch(e){if(denied(e))throw Error('Slow down: wait a few seconds between messages.');throw e;}
  },
  async remove(room,id){const {fs,d}=await db();await fs.deleteDoc(fs.doc(d,'chatRooms',room,'messages',id));},
 };
}
