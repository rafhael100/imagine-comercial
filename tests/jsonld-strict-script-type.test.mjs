import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyJsonLdPage} from '../src/lib/jsonld-output-contract.mjs';

const ROOT='https://imaginecomunicacao.com.br/';
const organization={'@context':'https://schema.org','@type':'Organization',
  '@id':ROOT+'#organization',url:ROOT};
const webPage={'@context':'https://schema.org','@type':'WebPage',
  '@id':ROOT+'#webpage',url:ROOT,inLanguage:'pt-BR'};
const script=(type,document)=>'<script '+type+'>'+JSON.stringify(document)+'</script>';
const html=(orgType='type="application/ld+json"',pageType='type="application/ld+json"')=>
  '<!doctype html><html><head>'+
  script(orgType,organization)+script(pageType,webPage)+'</head></html>';

test('F274 authentic application/ld+json scripts retain Organization and WebPage parity',()=>{
  assert.equal(verifyJsonLdPage(html(),ROOT),true);
  assert.equal(verifyJsonLdPage(
    html("TYPE='application/ld+json'","type='application/ld+json'"),ROOT),true);
});

test('F274 bogus data-type and aria-type are not recognized as structured data',()=>{
  for(const fake of ['data-type','aria-type']){
    assert.throws(()=>verifyJsonLdPage(html(fake+'="application/ld+json"'),ROOT),
      /expected one Organization/);
    assert.throws(()=>verifyJsonLdPage(html('type="application/ld+json"',
      fake+'="application/ld+json"'),ROOT),/expected one WebPage/);
  }
  assert.throws(()=>verifyJsonLdPage(
    html('type="text/plain" data-type="application/ld+json"'),ROOT),
  /expected one Organization/);
});

test('F274 duplicate JSON-LD script type is denied before JSON interpretation',()=>{
  assert.throws(()=>verifyJsonLdPage(
    html('type="application/ld+json" type="application/ld+json"'),ROOT),
    /duplicate SEO attribute/);
  assert.throws(()=>verifyJsonLdPage(
    html('type=application/ld+json'),ROOT),/must be quoted/);
});
