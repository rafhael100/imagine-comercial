import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGscApiPageEvidence as review} from '../src/lib/gsc-page-api-review.mjs';
const domain='https://www.imaginecomunicacao.com.br';
const row=(url,clicks=1,impressions=100)=>({
  keys:[domain+url],clicks,impressions,ctr:clicks/impressions,position:8
});
test('review-only API evidence ranks real page shapes without authorizing redirects',()=>{
  const out=review({rows:[
    row('/o-que-fazemos/criacao-de-sites-institucional.html',2,200),
    row('/o-que-fazemos/criacao-de-loja-virtual.html',0,100),
    row('/fale-conosco.html?token=PERSON-SECRET-128',1,10),
    row('/unknown-legacy.html',0,30),
    row('/servicos/criacao-de-sites/',0,50)
  ]},{rowLimit:100});
  assert.equal(out.summary.rowsReceived,5);
  assert.equal(out.summary.legacyCandidateRows,1);
  assert.ok(out.summary.heldRows>=2);
  assert.equal(out.summary.unknownRows,1);
  assert.equal(out.summary.clicks,3);
  assert.equal(out.summary.impressions,390);
  assert.equal(out.rows[0].path,'/o-que-fazemos/criacao-de-sites-institucional.html');
  assert.equal(out.rows[0].proposedTarget,'/servicos/criacao-de-sites/');
  assert.equal(out.approvedRedirects,0);
  assert.equal(out.productionRedirectsAuthorized,false);
  assert.doesNotMatch(JSON.stringify(out),/PERSON-SECRET-128/);
});
test('rejects forged metadata, permissions and unknown page attributes',()=>{
  for(const response of [
    {rows:[row('/fale-conosco.html')],oauthVerified:true},
    {rows:[{...row('/fale-conosco.html'),access_token:'secret'}]},
    {rows:[row('/fale-conosco.html')],responseAggregationType:'byProperty'},
    {rows:[row('/fale-conosco.html')],metadata:{first_incomplete_date:null}},
    {rows:[row('/fale-conosco.html')],metadata:{first_incomplete_hour:false}},
    {rows:[row('/fale-conosco.html')],metadata:{authorization:'OK'}}
  ])assert.throws(()=>review(response));
});
test('rejects foreign domains, unsafe URLs, inconsistent metric and duplicated rows',()=>{
  for(const bad of [
    {rows:[{...row('/fale-conosco.html'),keys:['https://evil.example/path']}]},
    {rows:[row('/fale-conosco.html',200,100)]},
    {rows:[{...row('/fale-conosco.html'),ctr:0.97}]},
    {rows:[row('/fale-conosco.html'),row('/fale-conosco.html')]},
    {rows:[row('/a/../fale-conosco.html')]},
    {rows:[row('/fale-conosco.html?x=person@example.com')],metadata:null}
  ])assert.throws(()=>review(bad));
});
test('empty response and bounded page limit do not fabricate historic traffic',()=>{
  const empty=review({rows:[]},{rowLimit:20});
  assert.equal(empty.summary.rowsReceived,0);
  assert.deepEqual(empty.rows,[]);
  assert.equal(empty.summary.sourceMayBeTruncated,false);
  assert.equal(review({rows:[row('/fale-conosco.html')]},{rowLimit:1})
    .summary.sourceMayBeTruncated,true);
  assert.throws(()=>review({rows:[row('/fale-conosco.html')]},{rowLimit:0}));
});
test('hidden and inherited reply fields cannot create implicit approvals',()=>{
  const hidden={rows:[row('/fale-conosco.html')]};
  Object.defineProperty(hidden,'productionAuthorized',{value:true});
  const inherited=Object.assign(Object.create({oauthVerified:true}),{
    rows:[row('/fale-conosco.html')]
  });
  assert.throws(()=>review(hidden),/invalid bounded response/);
  assert.throws(()=>review(inherited),/invalid bounded response/);
});
