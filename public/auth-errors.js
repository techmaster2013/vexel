const badCredentials=new Set(['auth/invalid-credential','auth/invalid-login-credentials','auth/wrong-password','auth/user-not-found','auth/invalid-email','auth/missing-password','auth/invalid-identifier']);
export function loginFailure(error){return error?.status===401||badCredentials.has(error?.code)?'Incorrect login!':error?.message||'Sign-in could not complete. Please try again.';}
export function friendlyAuthError(error){
 const code=error?.code||'';
 const messages={'auth/unauthorized-domain':'Add techmaster2013.github.io to Firebase Authentication’s authorized domains.','auth/operation-not-allowed':'Enable this sign-in provider in Firebase Authentication.','auth/popup-blocked':'Allow the sign-in popup, then try again.','auth/popup-closed-by-user':'Sign-in was cancelled. Please try again.','auth/email-already-in-use':'That username or email is already registered.','auth/account-exists-with-different-credential':'Use the sign-in method you originally chose for this email.','auth/network-request-failed':'Could not reach the sign-in service. Check your connection.','auth/too-many-requests':'Too many attempts. Wait a little and try again.'};
 return Object.assign(new Error(badCredentials.has(code)?'Incorrect login!':messages[code]||'Sign-in did not complete. Please try again.'),{code,status:badCredentials.has(code)?401:undefined});
}
