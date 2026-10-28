import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// mirror-sw.js is a classic service-worker script; run it the way importScripts would.
const context={URL,Response,Headers};vm.createContext(context);
vm.runInContext(await readFile(new URL('../public/mirror-sw.js',import.meta.url),'utf8')+';this.vexelMirror=vexelMirror;',context);
const {target,contentType,cleanHtml}=context.vexelMirror;
const scope='https://techmaster2013.github.io/vexel/';
test('mirror maps only owner repositories under the gh/ prefix to raw GitHub files',()=>{
 const found=target(scope+'gh/game-hub/karlson/index.html',scope);
 assert.equal(found.raw,'https://raw.githubusercontent.com/techmaster2013/game-hub/HEAD/karlson/index.html');
 assert.equal(found.base,scope+'gh/game-hub/');
 assert.equal(found.own,false);
 assert.equal(target(scope+'gh/game-hub/omori-fixed/index.html?own',scope).own,true);
 assert.equal(target(scope+'gh/t9_z13/Games/holeio/',scope).path,'Games/holeio/index.html');
 assert.equal(target(scope+'gh/angry',scope).path,'index.html');
 for(const url of [scope+'index.html',scope+'~/sj/x',scope+'gh/../sw.js',scope+'gh/game-hub/../../x','https://evil.example/vexel/gh/a/b',scope+'gh/a%2Fb/x'])
  assert.equal(target(url,scope),null,url);
});
test('mirror serves the content types browsers require for games',()=>{
 assert.equal(contentType('Build/game.wasm'),'application/wasm');
 assert.equal(contentType('index.html'),'text/html');
 assert.equal(contentType('a/b.JS'),'text/javascript');
 assert.equal(contentType('Build/angry.data.unityweb00'),'application/octet-stream');
 assert.equal(contentType('Lacey%27s%20Flash%20Games.png'),'image/png');
});
test('mirror strips popunder ads and trackers but keeps game code and SDKs',()=>{
 const base=scope+'gh/t9_z13/';
 const html=cleanHtml(`<script src="//spitefuldecision.com/x.js"></script><script>(function(){var s="//al5sm.com/tag.min.js"})()</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><script src="https://cdn.jsdelivr.net/gh/x/sdk.js" id="gamemonetize-sdk"></script>
<script src="Build/UnityLoader.js"></script><iframe src="/Games/1v1lol-main/"></iframe><img src="//cdn.example/a.png">`,base);
 assert.doesNotMatch(html,/spitefuldecision|al5sm|googletagmanager/);
 assert.match(html,/gamemonetize-sdk/);
 assert.match(html,/src="Build\/UnityLoader\.js"/);
 assert.match(html,/src="\/vexel\/gh\/t9_z13\/Games\/1v1lol-main\/"/);
 assert.match(html,/src="\/\/cdn\.example\/a\.png"/);
 const big='<script>'+'x'.repeat(70000)+'//googletagmanager</script>';
 assert.equal(cleanHtml(big,base),big);
});
test('own-files pages drop a dead CDN base so the repository copy is used',()=>{
 const page='<base href="https://cdn.jsdelivr.net/gh/genizy/web-port@main/omori-fixed/"><script>const baseUrl = "https://cdn.jsdelivr.net/gh/Reeyuki/angry2@main/";</script><script src="js/main.js"></script>';
 const own=cleanHtml(page,scope+'gh/game-hub/',true);
 assert.doesNotMatch(own,/<base|jsdelivr/);
 assert.match(own,/const baseUrl = "\.\/"/);
 assert.match(cleanHtml(page,scope+'gh/game-hub/'),/<base href="https:\/\/cdn\.jsdelivr/);
});
