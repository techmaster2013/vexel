import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEdits} from '../public/content-store.js';
test('editor entries survive save/reload and reject executable or insecure addresses',()=>{
 const data=validateEdits({games:[{title:'Test',url:'https://example.com/game'}],movies:[{title:'Film',url:'https://example.com/film.mp4'}],wispUrl:'wss://example.com/wisp/'});
 assert.deepEqual(validateEdits(data),data);
 for(const url of ['javascript:alert(1)','data:text/html,test','http://example.com'])assert.throws(()=>validateEdits({games:[{title:'Test',url}],movies:[]}));
 assert.throws(()=>validateEdits({games:[],movies:[],wispUrl:'https://example.com'}));
 assert.throws(()=>validateEdits({games:Array(201).fill({}),movies:[]}));
});
