import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyBlockHtml,htmlBlockEvidence,isPublicAddress,inspectExternalPage} from '../server/block-probe.mjs';
import {classifyBlockEvidence} from '../public/block-signatures.js';
test('block signatures survive dynamic IDs, formatting, entities and wrapper changes',()=>{
 for(const html of [
  '<title>Content blocked</title><h1>Content blocked</h1><p>Request 918273</p>',
  '<title>School filtering</title><main data-session="changing-id"><h1> CONTENT&nbsp; <span>BLOCKED!</span></h1><p>Time: 2026-10-24 13:00</p></main>',
  '<div class="notice">Content blocked</div><p>Request ID: different-every-time</p>',
  '<h1>Access denied</h1><img alt="GoGuardian"><p>Your administrator has blocked this category.</p>',
  '<title>Website blocked</title><p>Securly web filter: blocked by school policy.</p>',
  '<h2>Web Filter Violation</h2><p>FortiGuard: the administrator policy prevents this connection.</p>',
  '<h1>This webpage has been blocked.</h1><p>Contact your school administrator.</p>'
 ]){const result=classifyBlockHtml(html);assert.equal(result.blocked,true,html);assert.ok(result.signature);}
});
test('blank, loading, offline, frame restrictions and unrelated errors never imply a network block',()=>{
 for(const html of [
  '', '<html><body></body></html>', '<title>Game</title><canvas></canvas><p>Loading…</p>',
  '<title>503 Service Unavailable</title><h1>Service unavailable</h1>',
  '<title>403 Forbidden</title><h1>Access denied</h1><p>Sign in to your game account.</p>',
  '<title>Game</title><p>Refused to display in a frame because X-Frame-Options is SAMEORIGIN.</p>',
  '<h1>Offline</h1><p>The server could not be reached.</p>',
  '<h1>Game help</h1><p>If you see Content blocked, ask an administrator.</p>',
  '<h1>Game help</h1><p>Content blocked</p><p>This article explains the error.</p>',
  '<title>Game</title><script>const error="Content blocked";const vendor="GoGuardian";</script><canvas></canvas>',
  '<title>Game</title><div hidden><h1>Content blocked</h1></div><canvas></canvas>',
  '<div style="display:none"><h1>Content blocked</h1></div><p>Play game</p>',
  '<h1><script>"Content blocked"</script>Normal game</h1>',
  '<title>Content blocked - troubleshooting guide</title><h1>Fix your connection</h1>',
  '<title>Attention Required</title><h1>Sorry, you have been blocked</h1><p>Cloudflare security check.</p>'
 ])assert.equal(classifyBlockHtml(html).blocked,false,html);
});
test('browser and server evidence use the same signature policy',()=>{
 const html='<h1>Content blocked</h1><p>Request ID changes on each response.</p>';
 assert.deepEqual(classifyBlockHtml(html),classifyBlockEvidence(htmlBlockEvidence(html)));
 assert.equal(classifyBlockEvidence({title:'Game',text:''}).blocked,false);
});
test('probe refuses local, private and mapped destinations rather than probing internal services',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.5.8','192.168.0.1','169.254.169.254','::1','::ffff:127.0.0.1','fc00::1','fe80::1','0.0.0.0'])assert.equal(isPublicAddress(ip),false,ip);
 for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])assert.equal(isPublicAddress(ip),true,ip);
 const result=await inspectExternalPage('https://test.example/',{resolveHost:async()=>[{address:'127.0.0.1',family:4}]});assert.equal(result.blocked,false);assert.equal(result.inspection,'unavailable');
 assert.equal((await inspectExternalPage('http://test.example/')).blocked,false);
 assert.equal((await inspectExternalPage('not a URL')).blocked,false);
});
