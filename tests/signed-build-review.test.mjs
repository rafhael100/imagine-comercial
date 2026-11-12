import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createSignedBuildReview} from '../src/lib/signed-build-review.mjs';
import {sitePages,toAbsoluteUrl} from '../src/data/services.mjs';

const DOMAIN=Buffer.from('imagine-commercial-catalog-v1\0');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const keyId='portal_test_f24';
const pem=publicKey.export({type:'spki',format:'pem'}).toString();
const trust=new Map([[keyId,pem]]);
const item={
  id:'service_f24_landing',slug:'landing-pages',path:'/servicos/landing-pages/',
  title:'Landing Pages empresariais assinadas para revisão',
  description:'Descrição pública assinada e vinculada aos arquivos Astro, somente para validação offline em ambiente controlado.',
  version:2,status:'published'
};
const makeSnapshot=(overrides={})=>({
  schemaVersion:'1.0',releaseId:'release_20261109_f24',
  publishedAt:'2026-11-09T15:00:00Z',items:[item],...overrides
});
function signed(snapshot=makeSnapshot()) {
  const payload=Buffer.from(JSON.stringify(snapshot),'utf8');
  return {protocol:'imagine-catalog-v1',keyId,
    payloadBase64:payload.toString('base64'),
    signatureBase64:sign(null,Buffer.concat([DOMAIN,payload]),privateKey).toString('base64')};
}
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
function page(path,title='Página pública de demonstração Imagine',description='Descrição pública padrão para teste de integridade do HTML compilado.') {
  const url=toAbsoluteUrl(path);
  return '<!doctype html><html lang="pt-BR"><head><title>'+escape(title)+'</title>'+
    '<meta name="description" content="'+escape(description)+'">'+
    '<meta name="robots" content="index,follow">'+
    '<link rel="canonical" href="'+url+'">'+
    '<meta property="og:url" content="'+url+'">'+
    '<meta property="og:type" content="'+(/^\/conteudos\/[a-z0-9-]+\/$/.test(path)?'article':'website')+'">'+
    '<meta property="og:title" content="'+escape(title)+'">'+
    '<meta property="og:description" content="'+escape(description)+'">'+
    '<meta name="twitter:card" content="summary">'+
    '<meta name="twitter:url" content="'+url+'">'+
    '<meta name="twitter:title" content="'+escape(title)+'">'+
    '<meta name="twitter:description" content="'+escape(description)+'">'+
    '</head><body><section class="hero"><p class="lead">'+escape(description)+
    '</p></section></body></html>';
}
const bytes=text=>Buffer.from(text,'utf8');
const filePath=path=>path==='/'?'index.html':path.slice(1)+'index.html';
function sampleFiles() {
  return [
    ...sitePages.map(x=>({path:filePath(x.path),bytes:bytes(
      x.path===item.path?page(x.path,item.title,item.description):page(x.path)
    )})),
    {path:'404.html',bytes:bytes('<html><meta name="robots" content="noindex,nofollow"></html>')},
    {path:'robots.txt',bytes:bytes('User-agent: *\nAllow: /\n')},
    {path:'sitemap.xml',bytes:bytes('<urlset></urlset>')},
    {path:'_astro/site.css',bytes:bytes('body{margin:0}')}
  ];
}
const pins=envelope=>({
  expectedReleaseId:makeSnapshot().releaseId,
  expectedPayloadSha256:createHash('sha256')
    .update(Buffer.from(envelope.payloadBase64,'base64')).digest('hex')
});
const mutate=(files, path, change)=>files.map(file=>file.path===path
  ? {...file,bytes:bytes(change(file.bytes.toString('utf8')))} : file);

test('F24 liga catálogo Ed25519, release fixado, HTML e árvore SHA-256',()=>{
  const env=signed();
  const proof=createSignedBuildReview(sampleFiles(),env,trust,pins(env));
  assert.equal(proof.mode,'SIGNED_BUILD_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY');
  assert.equal(proof.releaseId,makeSnapshot().releaseId);
  assert.equal(proof.keyId,keyId);
  assert.equal(proof.verifiedServiceCount,1);
  assert.equal(proof.fileCount,sitePages.length+4);
  assert.match(proof.treeSha256,/^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(proof));
});

test('F24 rejeita assinatura e chave adulteradas, mesmo com digest pinado',()=>{
  const env=signed();
  assert.throws(()=>createSignedBuildReview(sampleFiles(),{
    ...env,signatureBase64:Buffer.alloc(64,3).toString('base64')
  },trust,pins(env)),/verification failed/);
  assert.throws(()=>createSignedBuildReview(sampleFiles(),env,new Map(),pins(env)),
    /unknown key ID/);
  assert.throws(()=>createSignedBuildReview(sampleFiles(),env,trust,{
    ...pins(env),expectedPayloadSha256:'0'.repeat(64)
  }),/payload digest/);
  assert.throws(()=>createSignedBuildReview(sampleFiles(),env,trust,{
    ...pins(env),expectedReleaseId:'release_other_f24'
  }),/unexpected release ID/);
});

test('F24 rejeita HTML com título, meta descrição ou intro diferentes dos dados assinados',()=>{
  const env=signed(),path='servicos/landing-pages/index.html',files=sampleFiles();
  for(const [from,to] of [
    [item.title,'Título alterado sem aprovação'],
    ['content="'+escape(item.description)+'"','content="Descrição incompatível"'],
    ['<p class="lead">'+escape(item.description)+'</p>','<p class="lead">Resumo diferente</p>']
  ]){
    const changed=mutate(files,path,html=>html.replace(from,to));
    assert.throws(()=>createSignedBuildReview(changed,env,trust,pins(env)),
      /HTML title differs|description differs|intro differs/);
  }
});

test('F24 bloqueia páginas extras, ausentes ou canonical divergente',()=>{
  const env=signed(),files=sampleFiles();
  assert.throws(()=>createSignedBuildReview(files.filter(x=>x.path!=='index.html'),
    env,trust,pins(env)),/unexpected or missing HTML output/);
  assert.throws(()=>createSignedBuildReview([
    ...files,{path:'outra/index.html',bytes:bytes(page('/'))}
  ],env,trust,pins(env)),/unexpected or missing HTML output/);
  const wrong=mutate(files,'servicos/landing-pages/index.html',
    html=>html.replace(toAbsoluteUrl(item.path),'https://example.org/'));
  assert.throws(()=>createSignedBuildReview(wrong,env,trust,pins(env)),
    /canonical URL mismatch/);
});

test('F24 recusa slug que não pertence ao catálogo editorial, mesmo assinado',()=>{
  const env=signed(makeSnapshot({items:[{
    ...item,slug:'servico-nao-homologado',path:'/servicos/servico-nao-homologado/'
  }]}));
  assert.throws(()=>createSignedBuildReview(sampleFiles(),env,trust,pins(env)),
    /service slug not in curated pages/);
});

test('F218 signed build review refuses a future-scheduled release even when signature and pin are valid',()=>{
  const future=makeSnapshot({publishedAt:'2099-01-01T00:00:00Z'});
  const env=signed(future),files=sampleFiles();
  assert.throws(()=>createSignedBuildReview(files,env,trust,pins(env)),
    /signed publication is in the future/);
  assert.throws(()=>createSignedBuildReview(files,env,trust,pins(env),
    {nowMs:Date.parse('2098-12-31T23:54:59Z')}),
    /signed publication is in the future/);
  const approvedWindow=createSignedBuildReview(files,env,trust,pins(env),
    {nowMs:Date.parse('2098-12-31T23:55:00Z')});
  assert.equal(approvedWindow.mode,
    'SIGNED_BUILD_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY');
  assert.ok(approvedWindow.treeSha256);
  assert.throws(()=>createSignedBuildReview(files,env,trust,pins(env),
    {nowMs:NaN}),/invalid verification time/);
});
test('F218 independent verifier reuses the exact dated signed-build review',()=>{
  const verifier=readFileSync(new URL('../src/lib/protected-artifact-verification.mjs',import.meta.url),'utf8');
  const builder=readFileSync(new URL('../scripts/build-protected-release.mjs',import.meta.url),'utf8');
  assert.match(verifier,/createSignedBuildReview\(files,envelope,trustKeys,pins\)/);
  assert.match(builder,/enforceSignedPublicationTime\(snapshot\.publishedAt\)/);
  assert.match(builder,/signed-publication-time\.mjs/);
  assert.doesNotMatch(builder,/from '\.\.\/src\/lib\/build-catalog\.mjs'/);
  const signedSource=readFileSync(new URL('../src/lib/signed-build-review.mjs',import.meta.url),'utf8');
  assert.match(signedSource,/signed-publication-time\.mjs/);
  assert.doesNotMatch(signedSource,/from '\.\/build-catalog\.mjs'/);
});
