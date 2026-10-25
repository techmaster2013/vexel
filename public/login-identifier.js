const usernameDomain='usernames.vexel.invalid';
export function usernameLoginEmail(value){
 const name=String(value||'').trim().toLowerCase();
 if(!/^[a-z0-9_]{3,20}$/.test(name))throw Error('Use a username with 3–20 letters, numbers or underscores.');
 return name+'@'+usernameDomain;
}
export function loginEmail(value){
 const id=String(value||'').trim();
 if(!id.includes('@'))return usernameLoginEmail(id);
 if(id.length>254||!/^\S+@\S+\.\S+$/.test(id))throw Error('Enter your email or username.');
 return id;
}
export function isUsernameEmail(email){return String(email||'').toLowerCase().endsWith('@'+usernameDomain);}
