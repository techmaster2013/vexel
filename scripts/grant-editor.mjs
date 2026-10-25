// Run on your private backend with GOOGLE_APPLICATION_CREDENTIALS configured.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
const uid=process.argv[2];if(!uid)throw Error('Provide the Firebase UID of your existing GamePlaza admin account.');
initializeApp({credential:applicationDefault(),projectId:'gplaza-feedback'});
const auth=getAuth(),user=await auth.getUser(uid);
await auth.setCustomUserClaims(uid,{...user.customClaims,vexelAdmin:true});
console.log('Vexel editor permission granted. Sign out and sign in again.');
