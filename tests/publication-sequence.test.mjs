import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePublication } from '../src/lib/publication-sequence.mjs';

const baseItem={id:'service_landing_1',slug:'landing-pages',title:'Criação de Landing Pages profissionais',
  description:'Planejamento de páginas comerciais para apresentar ofertas e facilitar novos contatos.',
  path:'/servicos/landing-pages/',status:'published',version:1};
const make=(releaseId,publishedAt,items=[baseItem])=>({
  schemaVersion:'1.0',releaseId,publishedAt,items
});
const one=make('release_20261109_01','2026-11-09T00:00:00Z');
const two=make('release_20261109_02','2026-11-09T01:00:00Z',[{...baseItem,version:2,
  description:'Planejamento de páginas comerciais para apresentar ofertas, gerar consultas e facilitar novos contatos.'}]);

test('accepts initial version and reports added entries',()=>{
  const result=preparePublication(null,one);
  assert.equal(result.status,'ready');assert.equal(result.changes.added,1);
  assert.ok(Object.isFrozen(result.snapshot));
});
test('treats the exact same release as idempotent',()=>{
  const result=preparePublication(one,one);
  assert.equal(result.status,'noop');assert.equal(result.changes.unchanged,1);
});
test('requires new release ID and strictly newer timestamp',()=>{
  assert.throws(()=>preparePublication(one,{...two,releaseId:one.releaseId}),/same identifier/);
  assert.throws(()=>preparePublication(one,{...two,publishedAt:one.publishedAt}),/stale/);
});
test('rejects content changes without a version increase',()=>{
  const changed=make('release_20261109_03','2026-11-09T02:00:00Z',[
    {...baseItem,title:'Criação de Landing Pages para empresas'}
  ]);
  assert.throws(()=>preparePublication(one,changed),/without version bump/);
});
test('accepts legitimate version upgrade and prevents version rollback',()=>{
  const next=preparePublication(one,two);
  assert.deepEqual(next.changes,{added:0,updated:1,unchanged:0});
  const stale=make('release_20261109_04','2026-11-09T03:00:00Z',[
    {...baseItem,version:1}
  ]);
  assert.throws(()=>preparePublication(two,stale),/version rollback/);
});
test('requires review for page slug changes and disappearance',()=>{
  const moved=make('release_20261109_05','2026-11-09T02:00:00Z',[
    {...baseItem,version:2,slug:'landing-page',path:'/servicos/landing-page/'}
  ]);
  assert.throws(()=>preparePublication(one,moved),/reviewed redirect plan/);
  const removed=make('release_20261109_06','2026-11-09T02:00:00Z',[]);
  assert.throws(()=>preparePublication(one,removed),/archival approval/);
});
test('cannot silently accept private data or draft products',()=>{
  const leaked=make('release_20261109_07','2026-11-09T02:00:00Z',[{...baseItem,email:'private@example.com'}]);
  assert.throws(()=>preparePublication(one,leaked),/unsupported\/private/);
  const draft=make('release_20261109_08','2026-11-09T02:00:00Z',[{...baseItem,status:'draft'}]);
  assert.throws(()=>preparePublication(one,draft),/unpublished/);
});
