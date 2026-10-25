import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {providerConfig,createAuth} from '../server/auth.mjs';
const origin='http://localhost:3000';
const consumer='9188040d-6c67-4c5b-b112-36a304b66dad';
for(const name of ['google','microsoft','discord'])test(name+' authorization, identity validation, cookie binding and replay protection',async()=>{
 const providers=providerConfig({GOOGLE_CLIENT_ID:'google-id',GOOGLE_CLIENT_SECRET:'secret',MICROSOFT_CLIENT_ID:'ms-id',MICROSOFT_CLIENT_SECRET:'secret',DISCORD_CLIENT_ID:'discord-id',DISCORD_CLIENT_SECRET:'secret'});
 const p=providers[name],{privateKey,publicKey}=await generateKeyPair('RS256');
 const issuer=name==='google'?'https://accounts.google.com':name==='microsoft'?`https://login.microsoftonline.com/${consumer}/v2.0`:'https://discord.com';
 p.meta={issuer:name==='microsoft'?'https://login.microsoftonline.com/{tenantid}/v2.0':issuer,authorization_endpoint:'https://provider.test/authorize',token_endpoint:'https://provider.test/token',jwks_uri:'https://provider.test/keys'};
 const jwk=await exportJWK(publicKey);jwk.kid='test';let nonce,mode='valid',exchanges=0;
 const fetcher=async(url,options)=>{
  if(url.includes('/users/@me'))return Response.json({id:'123456789012345678'});
  exchanges++;assert.equal(options.body.get('redirect_uri'),origin+`/auth/${name}/callback`);assert.ok(options.body.get('code_verifier'));
  if(name==='discord')return Response.json({access_token:'test',token_type:'Bearer'});
  const payload={nonce:mode==='nonce'?'wrong':nonce,...(name==='microsoft'?{tid:consumer}:{})};
  const jwt=await new SignJWT(payload).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(issuer).setAudience(mode==='audience'?'wrong':p.id).setSubject('subject-123').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  return Response.json({id_token:jwt});
 };
 const auth=createAuth({providers,origin,fetcher,keySet:()=>createLocalJWKSet({keys:[jwk]})});
 const begin=async()=>{const f=await auth.start(name),dest=new URL(f.url);nonce=dest.searchParams.get('nonce');assert.equal(dest.searchParams.get('code_challenge_method'),'S256');assert.equal(dest.searchParams.get('scope'),name==='discord'?'identify':'openid profile email');return {...f,callback:new URL(origin+`/auth/${name}/callback?code=code&state=${dest.searchParams.get('state')}${name==='discord'?'&iss=https%3A%2F%2Fdiscord.com':''}`)};};
 let f=await begin();assert.deepEqual(await auth.complete(name,f.callback,f.binding),{subject:name==='discord'?'123456789012345678':'subject-123'});
 await assert.rejects(auth.complete(name,f.callback,f.binding));
 f=await begin();const before=exchanges;await assert.rejects(auth.complete(name,f.callback,'wrong'));assert.equal(exchanges,before);
 if(name!=='discord')for(const bad of ['nonce','audience']){mode=bad;f=await begin();await assert.rejects(auth.complete(name,f.callback,f.binding));}
 else {f=await begin();f.callback.searchParams.set('iss','https://evil.test');await assert.rejects(auth.complete(name,f.callback,f.binding));}
 mode='valid';f=await begin();f.callback.searchParams.set('error','access_denied');await assert.rejects(auth.complete(name,f.callback,f.binding));
});
test('providers are disabled without credentials and reject unsafe tenant configuration',async()=>{
 const auth=createAuth({providers:providerConfig({}),origin});assert.equal(auth.ready('discord'),false);await assert.rejects(auth.start('google'));assert.throws(()=>providerConfig({MICROSOFT_TENANT:'../other'}));
});
