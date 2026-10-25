import {friendlyAuthError} from "./auth-errors.js";
import {loginEmail,usernameLoginEmail,isUsernameEmail} from "./login-identifier.js";
// Loaded only when a real Firebase project has been configured.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithPopup,GoogleAuthProvider,OAuthProvider,signInWithEmailAndPassword,signInWithCustomToken,createUserWithEmailAndPassword,updateProfile,signOut,getIdTokenResult} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
export async function createClient(config){
 const auth=getAuth(initializeApp(config));
 await new Promise(resolve=>{const stop=onAuthStateChanged(auth,()=>{stop();resolve();});});
 const me=async()=>{
  const u=auth.currentUser;if(!u)return null;
  const {claims}=await getIdTokenResult(u);
  return {id:u.uid,username:u.displayName||u.email?.split('@')[0]||'player',email:isUsernameEmail(u.email)?null:u.email,coins:0,unlimitedCoins:claims.unlimitedCoins===true,admin:claims.admin===true,owned:[],preferences:{}};
 };
 async function run(fn){try{await fn();return me();}catch(e){throw friendlyAuthError(e);}}
 return {me,customToken:token=>run(async()=>{const result=await signInWithCustomToken(auth,token);if(!result.user.displayName)await updateProfile(result.user,{displayName:"discord_"+result.user.uid.split(":").pop().slice(-6)});}),provider:name=>run(()=>{const p=name==='google'?new GoogleAuthProvider():name==='microsoft'?new OAuthProvider('microsoft.com'):null;if(!p)throw Error('Provider requires a backend callback.');return signInWithPopup(auth,p);}),login:(identifier,password)=>{let email;try{email=loginEmail(identifier);}catch{throw Object.assign(new Error("Incorrect login!"),{code:"auth/invalid-identifier",status:401});}return run(()=>signInWithEmailAndPassword(auth,email,password));},register:({username,email,password})=>run(async()=>{const address=email?loginEmail(email):usernameLoginEmail(username);const {user}=await createUserWithEmailAndPassword(auth,address,password);await updateProfile(user,{displayName:username});}),logout:()=>signOut(auth)};
}
