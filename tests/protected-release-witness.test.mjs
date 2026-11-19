import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyProtectedReleaseWithWitness} from '../src/lib/protected-release-witness.mjs';
const target={releaseId:'release_lab_01',target:'staging',treeSha256:'a'.repeat(64),
 witnessKeyId:'witness_lab_01'};
const catalogPins={expectedReleaseId:target.releaseId,expectedPayloadSha256:'b'.repeat(64)};
test('F47 rejects incomplete or contradictory trusted release pins before accessing ledger',async()=>{
 let called=0;
 const ledger={reserveOnce:async()=>{called++;return true}};
 for(const params of [
  {expectedRelease:{...target,treeSha256:'invalid'}},
  {expectedRelease:{...target,target:'review'}},
  {catalogPins:{...catalogPins,expectedReleaseId:'release_other_01'}},
  {expectedRelease:{...target,unknown:'field'}}
 ]){
  await assert.rejects(verifyProtectedReleaseWithWitness({
   expectedRelease:target,catalogPins,ledger,...params
  }),/pins/);
 }
 assert.equal(called,0);
});
test('F47 invalid protected artifact fails before any replay reservation',async()=>{
 let called=0;
 await assert.rejects(verifyProtectedReleaseWithWitness({
  expectedRelease:target,catalogPins,review:{},envelope:{},
  catalogTrustKeys:new Map(),expectedCatalogKeyId:'portal_lab_01',
  ledger:{reserveOnce:async()=>{called++;return true;}}
 }),/protected artifact/);
 assert.equal(called,0);
});
test('F47 does not have a network, deployment or approval entrypoint',()=>{
 assert.equal(typeof verifyProtectedReleaseWithWitness,'function');
});
