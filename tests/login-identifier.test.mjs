import {test} from 'node:test';
import assert from 'node:assert/strict';
import {usernameLoginEmail,loginEmail,isUsernameEmail} from '../public/login-identifier.js';
test('username-only Firebase identifiers are unique, case-normalized and distinct from email accounts',()=>{
 assert.equal(loginEmail(' Owner '),'owner@usernames.vexel.invalid');
 assert.equal(usernameLoginEmail('OWNER'),loginEmail('owner'));
 assert.equal(loginEmail('person@example.com'),'person@example.com');
 assert.equal(isUsernameEmail(loginEmail('owner')),true);
 assert.equal(isUsernameEmail('person@example.com'),false);
 for(const input of ['ab','bad/name','a'.repeat(21),'a b','<script>'])assert.throws(()=>usernameLoginEmail(input));
});
