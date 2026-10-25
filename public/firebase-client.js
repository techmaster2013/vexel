import {loginEmail,usernameLoginEmail,isUsernameEmail} from "./login-identifier.js";
// Loaded only when a real Firebase project has been configured.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithPopup,GoogleAuthProvider,OAuthProvider,signInWithEmailAndPassword,createUserWithEmailAndPassword,updateProfile,signOut,getIdTokenResult} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
export async function createClient(config){
 const auth=getAuth(initializeApp(config));
 await new Promise(resolve=>{const stop=onAuthStateChanged(auth,()=>{stop();resolve();});});
 const me=async()=>{
  const u=auth.currentUser;if(!u)return null;
  const {claims}=await getIdTokenResult(u);
  return {id:u.uid,username:u.displayName||u.email?.split('@')[0]||'player',email:isUsernameEmail(u.email)?null:u.email,coins:0,unlimitedCoins:claims.unlimitedCoins===true,admin:claims.admin===true,owned:[],preferences:{}};
 };
 const friendly=e=>{const code=e.code||'';return Error(code==='auth/unauthorized-domain'?'Add techmaster2013.github.io to Firebase Authentication’s authorized domains.':code==='auth/operation-not-allowed'?'Enable this provider in Firebase Authentication.':code==='auth/popup-blocked'?'Allow the sign-in popup, then try again.':code==='auth/email-already-in-use'?'That username or email is already registered.':code==='auth/account-exists-with-different-credential'?'Use the sign-in method you originally chose for this email.':'Sign-in did not complete. Check your details or try again.');};
 async function run(fn){try{await fn();return me();}catch(e){throw friendly(e);}}
 return {me,provider:name=>run(()=>{const p=name==='google'?new GoogleAuthProvider():name==='microsoft'?new OAuthProvider('microsoft.com'):null;if(!p)throw Error('Provider requires a backend callback.');return signInWithPopup(auth,p);}),login:(identifier,password)=>{const email=loginEmail(identifier);return run(()=>signInWithEmailAndPassword(auth,email,password));},register:({username,email,password})=>run(async()=>{const address=email?loginEmail(email):usernameLoginEmail(username);const {user}=await createUserWithEmailAndPassword(auth,address,password);await updateProfile(user,{displayName:username});}),logout:()=>signOut(auth)};
}
