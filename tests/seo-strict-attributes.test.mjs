import test from 'node:test';
import assert from 'node:assert/strict';
import {readStrictHtmlAttribute as attr} from '../src/lib/html-attribute-reader.mjs';
import {verifyIndexablePage} from '../src/lib/seo-output-contract.mjs';

const HOME='https://imaginecomunicacao.com.br/';
const fixture=()=>'<html lang="pt-BR"><head>'+
  '<link rel="canonical" href="'+HOME+'"/>'+
  '<meta name="robots" content="index,follow"/>'+
  '<meta property="og:url" content="'+HOME+'"/>'+
  '<meta property="og:type" content="website"/>'+
  '<meta property="og:title" content="Imagine Comunicação Digital"/>'+
  '<meta property="og:description" content="Presença digital profissional para empresas." />'+
  '<meta name="twitter:card" content="summary"/>'+
  '<meta name="twitter:url" content="'+HOME+'"/>'+
  '<meta name="twitter:title" content="Imagine Comunicação Digital"/>'+
  '<meta name="twitter:description" content="Presença digital profissional para empresas." />'+
  '</head><body><h1>Imagine</h1></body></html>';

test('F269 HTML parser distinguishes exact SEO attributes from prefixed fields',()=>{
  assert.equal(attr('<link data-rel="canonical" aria-href="/wrong/" rel="canonical" href="'+HOME+'"/>','rel'),'canonical');
  assert.equal(attr('<link data-rel="canonical" data-href="'+HOME+'"/>','rel'),null);
  assert.equal(attr('<meta title="content=evil" content="index,follow"/>','content'),'index,follow');
  assert.equal(attr('<meta data-name="robots" />','name'),null);
  assert.equal(attr('<meta name='+"'"+'robots'+"'"+' content="index,follow"/>','name'),'robots');
  for(const tag of [
    '<link rel="canonical" REL="canonical"/>',
    '<meta name=robots content="index,follow"/>',
    '<link rel="canonical" href="a" href="b"/>',
    '<meta name="robots" data-x=bad<broken/>'
  ])assert.throws(()=>attr(tag,tag.startsWith('<meta')?'name':'href'),/F269:/);
});

test('F269 compiled metadata audit rejects a fake canonical or robot directive',()=>{
  assert.equal(verifyIndexablePage(fixture(),HOME),true);
  const withoutCanonical=fixture().replace('<link rel="canonical" href="'+HOME+'"/>',
    '<link data-rel="canonical" data-href="'+HOME+'"/>');
  assert.throws(()=>verifyIndexablePage(withoutCanonical,HOME),/exactly one canonical/);
  const withoutRobots=fixture().replace('<meta name="robots" content="index,follow"/>',
    '<meta data-name="robots" data-content="index,follow"/>');
  assert.throws(()=>verifyIndexablePage(withoutRobots,HOME),/one robots meta/);
  const duplicateRel=fixture().replace('<link rel="canonical" href="'+HOME+'"/>',
    '<link rel="canonical" rel="canonical" href="'+HOME+'"/>');
  assert.throws(()=>verifyIndexablePage(duplicateRel,HOME),/duplicate SEO attribute/);
});

test('F269 social parity cannot be forged by data-property and aria-name',()=>{
  const fakeOg=fixture().replace('<meta property="og:url" content="'+HOME+'"/>',
    '<meta data-property="og:url" data-content="'+HOME+'"/>');
  assert.throws(()=>verifyIndexablePage(fakeOg,HOME),/one og:url/);
  const fakeTwitter=fixture().replace('<meta name="twitter:card" content="summary"/>',
    '<meta aria-name="twitter:card" data-content="summary"/>');
  assert.throws(()=>verifyIndexablePage(fakeTwitter,HOME),/one Twitter card type/);
});
