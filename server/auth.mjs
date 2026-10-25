import {randomBytes,createHash} from 'node:crypto';
import {createRemoteJWKSet,decodeJwt,jwtVerify} from 'jose';
const hash=s=>createHash('sha256').update(s).digest('base64url');
const random=()=>randomBytes(32).toString('base64url');
export const authError=(message,status=400)=>Object.assign(new Error(message),{status});
export function providerConfig(env){
 const tenant=env.MICROSOFT_TENANT||'consumers';
 if(!/^(consumers|common|organizations|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(tenant))throw Error('Invalid MICROSOFT_TENANT');
 return {
  google:{id:env.GOOGLE_CLIENT_ID,secret:env.GOOGLE_CLIENT_SECRET,discovery:'https://accounts.google.com/.well-known/openid-configuration',scope:'openid profile email'},
  microsoft:{id:env.MICROSOFT_CLIENT_ID,secret:env.MICROSOFT_CLIENT_SECRET,tenant,discovery:`https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`,scope:'openid profile email'},
  discord:{id:env.DISCORD_CLIENT_ID,secret:env.DISCORD_CLIENT_SECRET,scope:'identify',meta:{issuer:'https://discord.com',authorization_endpoint:'https://discord.com/oauth2/authorize',token_endpoint:'https://discord.com/api/oauth2/token'}},
 };
}
// Dependencies are injectable for local signed-token tests; production uses fixed provider endpoints.
export function createAuth({providers,origin,fetcher=fetch,keySet=createRemoteJWKSet,now=Date.now}){
 const flows=new Map();
 const ready=name=>Boolean(providers[name]?.id&&providers[name]?.secret);
 async function metadata(p){
  if(!p.meta){const r=await fetcher(p.discovery,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw authError('Identity provider unavailable.',502);p.meta=await r.json();}
  return p.meta;
 }
 async function start(name){
  if(!ready(name))throw authError('This sign-in provider needs deployment credentials.',503);
  for(const [state,f]of flows)if(f.expires<now())flows.delete(state);
  if(flows.size>=1000)throw authError('Sign-in is busy. Please try again.',503);
  const p=providers[name],meta=await metadata(p),state=random(),binding=random(),verifier=random(),nonce=random();
  const redirect=origin+`/auth/${name}/callback`;
  flows.set(state,{name,binding:hash(binding),verifier,nonce,expires:now()+600000,redirect});
  const dest=new URL(meta.authorization_endpoint);
  dest.search=new URLSearchParams({client_id:p.id,redirect_uri:redirect,response_type:'code',scope:p.scope,state,code_challenge:hash(verifier),code_challenge_method:'S256',...(name==='discord'?{}:{nonce})});
  return {url:dest.href,binding};
 }
 async function complete(name,url,binding){
  const state=url.searchParams.get('state'),f=flows.get(state);flows.delete(state);
  if(!f||f.name!==name||f.expires<now()||f.binding!==hash(binding||''))throw authError('Sign-in expired. Please try again.');
  if(url.searchParams.has('error'))throw authError('Sign-in was cancelled or declined.');
  const code=url.searchParams.get('code');if(!code||code.length>8192)throw authError('Sign-in response was incomplete.');
  const p=providers[name],meta=await metadata(p);
  if(name==='discord'&&url.searchParams.get('iss')!==meta.issuer)throw authError('Identity provider did not match.',401);
  const r=await fetcher(meta.token_endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:p.id,client_secret:p.secret,grant_type:'authorization_code',redirect_uri:f.redirect,code,code_verifier:f.verifier}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw authError('Provider rejected sign-in.',401);
  const token=await r.json();
  if(name==='discord'){
   if(typeof token.access_token!=='string'||token.token_type?.toLowerCase()!=='bearer')throw authError('Identity verification failed.',401);
   const response=await fetcher('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw authError('Identity verification failed.',401);
   const profile=await response.json();if(!/^\d{10,25}$/.test(profile.id||''))throw authError('Identity verification failed.',401);
   return {subject:profile.id};
  }
  if(typeof token.id_token!=='string')throw authError('Provider returned no identity token.',401);
  let issuer=meta.issuer;
  if(name==='microsoft'){
   const tid=decodeJwt(token.id_token).tid;
   if(!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(tid||''))throw authError('Invalid tenant.',401);
   const consumer='9188040d-6c67-4c5b-b112-36a304b66dad';
   if((p.tenant==='consumers'&&tid!==consumer)||(p.tenant==='organizations'&&tid===consumer)||(!['consumers','common','organizations'].includes(p.tenant)&&p.tenant.toLowerCase()!==tid.toLowerCase()))throw authError('This Microsoft account type is not enabled.',401);
   issuer=issuer.replace('{tenantid}',tid);
  }
  const {payload}=await jwtVerify(token.id_token,keySet(new URL(meta.jwks_uri)),{audience:p.id,issuer:name==='google'?[issuer,'accounts.google.com']:issuer,algorithms:['RS256']});
  if(payload.nonce!==f.nonce||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255)throw authError('Identity verification failed.',401);
  return {subject:payload.sub};
 }
 return {start,complete,ready};
}
