import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifySignedCatalog } from '../src/lib/verify-signed-catalog.mjs';

const DOMAIN=Buffer.from('imagine-commercial-catalog-v1\0','utf8');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pem=publicKey.export({format:'pem',type:'spki'}).toString();
const keys=new Map([['portal_key_01',pem]]);
const makePayload=()=>({
  schemaVersion:'1.0',releaseId:'release_20261109_03',publishedAt:'2026-11-09T01:00:00Z',
  items:[{
    id:'service_landing_1',slug:'landing-pages',
    title:'Criação de Landing Pages profissionais',
    description:'Planejamento de páginas comerciais para apresentar ofertas e facilitar novos contatos.',
    path:'/servicos/landing-pages/',status:'published',version:3
  }]
});
const signed=(payload=makePayload())=>{
  const bytes=Buffer.from(JSON.stringify(payload),'utf8');
  const signature=sign(null,Buffer.concat([DOMAIN,bytes]),privateKey);
  return {protocol:'imagine-catalog-v1',keyId:'portal_key_01',
    payloadBase64:bytes.toString('base64'),signatureBase64:signature.toString('base64')};
};
test('accepts authentic published content signed by an authorized Ed25519 key',()=>{
  const snap=verifySignedCatalog(signed(),keys);
  assert.equal(snap.items[0].slug,'landing-pages');
  assert.ok(Object.isFrozen(snap.items[0]));
});
test('rejects content tampering even if payload remains valid JSON',()=>{
  const envelope=signed();
  const raw=JSON.parse(Buffer.from(envelope.payloadBase64,'base64').toString('utf8'));
  raw.items[0].title='Landing Pages adulteradas';
  envelope.payloadBase64=Buffer.from(JSON.stringify(raw)).toString('base64');
  assert.throws(()=>verifySignedCatalog(envelope,keys),/verification failed/);
});
test('rejects unknown key, substituted signature and wrong context',()=>{
  assert.throws(()=>verifySignedCatalog({...signed(),keyId:'unknown_key'},keys),/unknown key ID/);
  const bad={...signed(),signatureBase64:Buffer.alloc(64,1).toString('base64')};
  assert.throws(()=>verifySignedCatalog(bad,keys),/verification failed/);
  const raw=Buffer.from(JSON.stringify(makePayload()));
  const wrongDomainSign=sign(null,Buffer.concat([Buffer.from('other-product\0'),raw]),privateKey);
  assert.throws(()=>verifySignedCatalog({...signed(),signatureBase64:wrongDomainSign.toString('base64')},keys),/verification failed/);
});
test('rejects private fields, drafts and schema violations after verifying signature',()=>{
  const sensitive=makePayload();sensitive.items[0].price=500;
  assert.throws(()=>verifySignedCatalog(signed(sensitive),keys),/unsupported\/private/);
  const draft=makePayload();draft.items[0].status='draft';
  assert.throws(()=>verifySignedCatalog(signed(draft),keys),/unpublished/);
});
test('rejects unknown envelope fields and invalid base64 and algorithms',()=>{
  assert.throws(()=>verifySignedCatalog({...signed(),token:'secret'},keys),/unexpected field/);
  assert.throws(()=>verifySignedCatalog({...signed(),protocol:'rsa'},keys),/unsupported protocol/);
  assert.throws(()=>verifySignedCatalog({...signed(),payloadBase64:'%'},keys),/invalid payload/);
  assert.throws(()=>verifySignedCatalog({...signed(),signatureBase64:'AQ=='},keys),/signature length/);
});
test('rejects oversized signed snapshots before parsing',()=>{
  const big={...signed(),payloadBase64:Buffer.alloc(1024*1024+1,65).toString('base64')};
  assert.throws(()=>verifySignedCatalog(big,keys),/invalid payload/);
});
test('rejects weak keys and missing trusted key map',()=>{
  assert.throws(()=>verifySignedCatalog(signed(),{}),/trusted key map/);
  const {publicKey:other}=generateKeyPairSync('rsa',{modulusLength:2048});
  const otherPem=other.export({type:'spki',format:'pem'}).toString();
  assert.throws(()=>verifySignedCatalog(signed(),new Map([['portal_key_01',otherPem]])),/Ed25519 key required/);
});

test('F193 rejects authentically signed malformed UTF-8 without replacement',()=>{
  const clean=Buffer.from(JSON.stringify(makePayload()),'utf8');
  // Mutate a single ASCII byte inside the title to an invalid UTF-8 lead.
  // Under lossy decoding, JSON remains parseable and contains U+FFFD.
  const needle=Buffer.from('Criação de Landing Pages profissionais','utf8');
  const offset=clean.indexOf(needle);
  assert.ok(offset>0);
  for(const malformed of [Buffer.from([0xc3,0x28]),Buffer.from([0xed,0xa0,0x80])]){
    const raw=Buffer.concat([clean.subarray(0,offset),malformed,
      clean.subarray(offset+1)]);
    assert.doesNotThrow(()=>JSON.parse(raw.toString('utf8')),
      'Node replacement decoding would hide invalid UTF-8');
    const authentic=sign(null,Buffer.concat([DOMAIN,raw]),privateKey);
    const env={protocol:'imagine-catalog-v1',keyId:'portal_key_01',
      payloadBase64:raw.toString('base64'),
      signatureBase64:authentic.toString('base64')};
    assert.throws(()=>verifySignedCatalog(env,keys),
      /invalid UTF-8 or JSON payload/);
  }
});

test('F197 even correctly signed deceptive editorial Unicode cannot reach the build',()=>{
  for(const title of [
    'Serviços digitais \u202e com direção falsa',
    'Serviços digitais \u200b ocultos',
    'Cria\u0301cao de páginas empresariais',
    'Serviços digitais \ud800 perigosos'
  ]){
    const payload=makePayload();
    payload.items[0].title=title;
    assert.throws(()=>verifySignedCatalog(signed(payload),keys),/invalid plain text/);
  }
});
