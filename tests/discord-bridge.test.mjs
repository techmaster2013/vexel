import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDiscordBridge} from '../server/discord-bridge.mjs';
import {isDiscordMessage} from '../public/discord-login.js';
test('Discord bridge is origin-bound, one-use, expires and never accepts an arbitrary subject',async()=>{
 let now=0,uid;const bridge=createDiscordBridge({pageOrigin:'https://techmaster2013.github.io',enabled:true,now:()=>now,mintToken:async id=>{uid=id;return 'custom.token.value';}});
 const channel='a'.repeat(64);bridge.remember('state',channel);const flow=bridge.take('state');assert.equal(flow.channel,channel);assert.equal(bridge.take('state'),null);
 assert.equal(await bridge.token('123456789012345678'),'custom.token.value');assert.equal(uid,'discord:123456789012345678');await assert.rejects(bridge.token('owner'));
 bridge.remember('expired',channel);now=600001;assert.equal(bridge.take('expired'),null);
 let status,headers,html;bridge.respond({writeHead:(s,h)=>{status=s;headers=h;},end:s=>html=s},flow,{token:'custom.token.value'});
 assert.equal(status,200);assert.equal(headers['Cache-Control'],'no-store');assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/);assert.match(html,/https:\/\/techmaster2013.github.io/);assert.match(html,/postMessage/);assert.doesNotMatch(html,/Location|location\.search/);
 assert.throws(()=>createDiscordBridge({pageOrigin:'https://example.com/path',enabled:true}));
 assert.throws(()=>createDiscordBridge({pageOrigin:'https://example.com',enabled:false}).remember('state',channel));
});
test('Discord popup messages must match backend origin, popup identity and random channel',()=>{
 const popup={},expected={origin:'https://backend.example.com',popup,channel:'nonce'};
 const event={origin:expected.origin,source:popup,data:{type:'vexel.discord.login',channel:'nonce',token:'test'}};
 assert.equal(isDiscordMessage(event,expected),true);
 assert.equal(isDiscordMessage({...event,origin:'https://evil.example'},expected),false);
 assert.equal(isDiscordMessage({...event,source:{}},expected),false);
 assert.equal(isDiscordMessage({...event,data:{...event.data,channel:'other'}},expected),false);
});
