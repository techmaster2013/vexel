import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loginFailure,friendlyAuthError} from '../public/auth-errors.js';
test('wrong credentials show the exact message while setup, network and rate errors remain distinct',()=>{
 for(const code of ['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-email'])assert.equal(loginFailure(friendlyAuthError({code})),'Incorrect login!');
 assert.equal(loginFailure({status:401,message:'hidden detail'}),'Incorrect login!');
 for(const code of ['auth/operation-not-allowed','auth/network-request-failed','auth/too-many-requests'])assert.notEqual(loginFailure(friendlyAuthError({code})),'Incorrect login!');
 assert.equal(loginFailure(Error('Account setup is pending.')),'Account setup is pending.');
});
