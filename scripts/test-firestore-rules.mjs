import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
// Firestore rules tests for chat, coins, the shop and the editor. They need Java and
// the Firebase emulator, so they are not part of `pnpm test`. Run from the repo root:
//   npx -y firebase-tools@14.27.0 emulators:exec --only firestore --project demo-vexel \
//     "node scripts/test-firestore-rules.mjs"
// (first: npm install --no-save @firebase/rules-unit-testing@5 firebase@12)
import {readFileSync} from 'node:fs';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,writeBatch,collection,increment,arrayUnion,serverTimestamp,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-vexel',firestore:{rules:"rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /feedback/{id} { allow create: if true; }\n"+readFileSync(new URL('../firestore.vexel.rules',import.meta.url),'utf8')+"  }\n}\n",host:'127.0.0.1',port:8080}});
let pass=0,fail=0;
async function t(name,kind,p){try{await (kind==='ok'?assertSucceeds(p):assertFails(p));pass++;console.log('  ✓',name);}catch(e){fail++;console.log('  ✗',name,e.message?.slice(0,150));}}
const ago=s=>Timestamp.fromMillis(Date.now()-s*1000);
const seed=(uid,data)=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'vexelUsers',uid),{username:uid,coins:0,owned:[],lastEarn:ago(600),lastChat:ago(600),...data}));
const db=(uid,claims={})=>env.authenticatedContext(uid,{name:uid,...claims}).firestore();
const anon=env.unauthenticatedContext().firestore();
console.log('profiles');
await t('create own profile with 0 coins','ok',setDoc(doc(db('ann'),'vexelUsers','ann'),{username:'ann',coins:0,owned:[],lastEarn:serverTimestamp(),lastChat:serverTimestamp()}));
await t('create profile with 100 coins','no',setDoc(doc(db('bob'),'vexelUsers','bob'),{username:'bob',coins:100,owned:[],lastEarn:serverTimestamp(),lastChat:serverTimestamp()}));
await t('create profile under another name than the account','no',setDoc(doc(db('bob'),'vexelUsers','bob'),{username:'techmaster2013',coins:0,owned:[],lastEarn:serverTimestamp(),lastChat:serverTimestamp()}));
await t('create someone else\'s profile','no',setDoc(doc(db('bob'),'vexelUsers','cat'),{username:'bob',coins:0,owned:[],lastEarn:serverTimestamp(),lastChat:serverTimestamp()}));
await t('read own profile','ok',getDoc(doc(db('ann'),'vexelUsers','ann')));
await seed('dan',{coins:5});
await t('read someone else\'s profile','no',getDoc(doc(db('ann'),'vexelUsers','dan')));
console.log('earning');
await t('earn right after signing up (too soon)','no',updateDoc(doc(db('ann'),'vexelUsers','ann'),{coins:increment(1),lastEarn:serverTimestamp()}));
await seed('eve',{});
await t('earn 3 a minute after the last reward','ok',updateDoc(doc(db('eve'),'vexelUsers','eve'),{coins:increment(3),lastEarn:serverTimestamp()}));
await t('earn again immediately','no',updateDoc(doc(db('eve'),'vexelUsers','eve'),{coins:increment(1),lastEarn:serverTimestamp()}));
await seed('fay',{});
await t('earn 50 at once','no',updateDoc(doc(db('fay'),'vexelUsers','fay'),{coins:increment(50),lastEarn:serverTimestamp()}));
await t('set coins directly','no',updateDoc(doc(db('fay'),'vexelUsers','fay'),{coins:9999}));
await t('earn without stamping the time','no',updateDoc(doc(db('fay'),'vexelUsers','fay'),{coins:increment(1)}));
console.log('shop');
await seed('gus',{coins:50});
await t('buy aurora (40) with 50 coins','ok',updateDoc(doc(db('gus'),'vexelUsers','gus'),{coins:increment(-40),owned:arrayUnion('aurora')}));
await t('buy ember (60) with 10 coins','no',updateDoc(doc(db('gus'),'vexelUsers','gus'),{coins:increment(-60),owned:arrayUnion('ember')}));
await seed('hal',{coins:100});
await t('buy ember for less than its price','no',updateDoc(doc(db('hal'),'vexelUsers','hal'),{coins:increment(-1),owned:arrayUnion('ember')}));
await t('add a theme without paying','no',updateDoc(doc(db('hal'),'vexelUsers','hal'),{owned:arrayUnion('rose')}));
await t('add an item that is not for sale','no',updateDoc(doc(db('hal'),'vexelUsers','hal'),{coins:increment(-1),owned:arrayUnion('gold')}));
await seed('ivy',{coins:0});
await t('unlimited-coins account takes a theme free','ok',updateDoc(doc(db('ivy',{unlimitedCoins:true}),'vexelUsers','ivy'),{coins:increment(0),owned:arrayUnion('rose')}));
console.log('grants');
await t('admin grants 100 coins','ok',updateDoc(doc(db('boss',{vexelAdmin:true}),'vexelUsers','dan'),{coins:increment(100)}));
await t('player grants themselves coins','no',updateDoc(doc(db('dan'),'vexelUsers','dan'),{coins:increment(100)}));
console.log('chat');
await seed('jo',{});await seed('kim',{});
const send=(uid,text,extra={})=>{const d=db(uid),b=writeBatch(d);b.set(doc(collection(d,'chatRooms','general','messages')),{uid,username:uid,text,created:serverTimestamp(),...extra});b.update(doc(d,'vexelUsers',uid),{lastChat:serverTimestamp()});return b.commit();};
await t('send a message','ok',send('jo','hi everyone'));
await t('send again within 3 seconds','no',send('jo','spam'));
await t('send as someone else','no',send('kim','i am jo',{username:'jo'}));
const sneaky=db('kim');await t('send without the rate-limit stamp','no',setDoc(doc(collection(sneaky,'chatRooms','general','messages')),{uid:'kim',username:'kim',text:'x',created:serverTimestamp()}));
await t('send to an unknown room','no',(()=>{const d=db('kim'),b=writeBatch(d);b.set(doc(collection(d,'chatRooms','secret','messages')),{uid:'kim',username:'kim',text:'x',created:serverTimestamp()});b.update(doc(d,'vexelUsers','kim'),{lastChat:serverTimestamp()});return b.commit();})());
await t('send an empty message','no',send('kim',''));
await t('send a 1001-character message','no',send('kim','x'.repeat(1001)));
await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'chatRooms','general','messages','m1'),{uid:'jo',username:'jo',text:'mine',created:Timestamp.now()}));
await t('read chat while signed in','ok',getDoc(doc(db('kim'),'chatRooms','general','messages','m1')));
await t('read chat signed out','no',getDoc(doc(anon,'chatRooms','general','messages','m1')));
await t('edit a message','no',updateDoc(doc(db('jo'),'chatRooms','general','messages','m1'),{text:'changed'}));
await t('delete someone else\'s message','no',deleteDoc(doc(db('kim'),'chatRooms','general','messages','m1')));
await t('delete own message','ok',deleteDoc(doc(db('jo'),'chatRooms','general','messages','m1')));
await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'chatRooms','general','messages','m2'),{uid:'jo',username:'jo',text:'bad',created:Timestamp.now()}));
await t('admin deletes any message','ok',deleteDoc(doc(db('boss',{admin:true}),'chatRooms','general','messages','m2')));
console.log('editor');
await t('anyone reads published editor additions','ok',getDoc(doc(anon,'vexel','site')));
await t('non-admin publishes editor additions','no',setDoc(doc(db('kim'),'vexel','site'),{payload:'{}',updatedAt:serverTimestamp()}));
await t('owner publishes editor additions','ok',setDoc(doc(db('PeDivPz9H3hvwW0TB33tgq6V4u63'),'vexel','site'),{payload:'{}',updatedAt:serverTimestamp()}));
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();process.exit(fail?1:0);
