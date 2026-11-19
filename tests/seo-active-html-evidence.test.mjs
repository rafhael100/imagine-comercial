import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyIndexablePage} from '../src/lib/seo-output-contract.mjs';
import {verifyJsonLdPage} from '../src/lib/jsonld-output-contract.mjs';
import {auditIndexableMetadata} from '../src/lib/site-head-inventory.mjs';

const ROOT='https://imaginecomunicacao.com.br/';
const social=()=>`<link rel="canonical" href="${ROOT}">
<meta name="robots" content="index,follow">
<meta property="og:url" content="${ROOT}">
<meta property="og:type" content="website">
<meta property="og:title" content="Synthetic commercial review">
<meta property="og:description" content="Synthetic description for local review.">
<meta name="twitter:card" content="summary">
<meta name="twitter:url" content="${ROOT}">
<meta name="twitter:title" content="Synthetic commercial review">
<meta name="twitter:description" content="Synthetic description for local review.">`;
const jsonld=()=>[
  {'@type':'Organization','@id':ROOT+'#organization',url:ROOT},
  {'@type':'WebPage','@id':ROOT+'#webpage',url:ROOT,inLanguage:'pt-BR'}
].map(value=>'<script type="application/ld+json">'+JSON.stringify(value)+'</script>').join('');
const wrappers=[
  ['comment',value=>'<!--'+value+'-->'],
  ['quoted attribute',value=>"<div data-example='"+value+"'></div>"],
  ['textarea',value=>'<textarea>'+value+'</textarea>'],
  ['nested template',value=>'<template><template>'+value+'</template></template>']
];

for(const [name,wrap] of wrappers){
  test('Active SEO evidence: '+name+' cannot supply missing metadata',()=>{
    assert.throws(()=>verifyIndexablePage('<head>'+wrap(social())+'</head>',ROOT),
      /expected exactly one canonical/);
  });
  test('Active JSON-LD evidence: '+name+' cannot supply missing entities',()=>{
    assert.throws(()=>verifyJsonLdPage(wrap(jsonld()),ROOT),/expected one Organization/);
  });
}

test('Active SEO evidence ignores inert duplicates beside actual metadata',()=>{
  const examples=wrappers.map(([,wrap])=>wrap(social())).join('');
  assert.equal(verifyIndexablePage('<head>'+social()+'</head>'+examples,ROOT),true);
});

test('Active JSON-LD evidence ignores inert duplicates beside actual entities',()=>{
  const examples=wrappers.map(([,wrap])=>wrap(jsonld())).join('');
  assert.equal(verifyJsonLdPage(jsonld()+examples,ROOT),true);
});

test('Active SEO attributes may contain an irrelevant quoted greater-than sign',()=>{
  assert.equal(verifyIndexablePage(social().replaceAll('<meta ',
    '<meta data-note="first > second" ').replaceAll('<link ',
    '<link data-note="first > second" '),ROOT),true);
});

test('Active JSON-LD attributes may contain an irrelevant quoted greater-than sign',()=>{
  assert.equal(verifyJsonLdPage(jsonld().replaceAll('<script ',
    '<script data-note="first > second" '),ROOT),true);
});

const declarations=[
  ['DOCTYPE SYSTEM single quote',"<!DOCTYPE html SYSTEM '","'>"],
  ['DOCTYPE SYSTEM double quote','<!DOCTYPE html SYSTEM "','">'],
  ['unknown HTML declaration',"<!bogus '","'>"],
  ['processing instruction',"<?audit '","'>"]
];

for(const [name,prefix,suffix] of declarations){
  test('Active JSON-LD evidence: '+name+' cannot supply the first SCRIPT opening',()=>{
    // The first > ends the declaration, consuming the Organization opening.
    // The later WebPage SCRIPT is active and cannot replace that missing entity.
    assert.throws(()=>verifyJsonLdPage(prefix+jsonld()+suffix,ROOT),
      /expected one Organization/);
  });
  test('Active JSON-LD evidence: '+name+' keeps real scripts after the first delimiter',()=>{
    // A quote-aware skip would incorrectly consume these real SCRIPT elements.
    assert.equal(verifyJsonLdPage(prefix+'declaration ends>'+jsonld()+suffix,ROOT),true);
  });
}

test('A normal HTML DOCTYPE preserves actual SEO metadata and JSON-LD',()=>{
  const html='<!DOCTYPE html><html><head>'+social()+jsonld()+'</head><body></body></html>';
  assert.equal(verifyIndexablePage(html,ROOT),true);
  assert.equal(verifyJsonLdPage(html,ROOT),true);
});

const title=i=>'Synthetic public page '+i+' for metadata contract review';
const description=i=>'This is synthetic description '+i+' with enough reviewed text for a local metadata inventory test.';
const meta=i=>'<title>'+title(i)+'</title><meta name="description" content="'+description(i)+'">';
const pages=render=>[1,2].map(i=>({path:'/synthetic-'+i+'/',html:render(i)}));

test('Active head inventory rejects metadata available only in a comment',()=>{
  assert.throws(()=>auditIndexableMetadata(pages(i=>'<head><!--'+meta(i)+'--></head>')),
    /expected one document title/);
});

test('Active head inventory does not invent a head from a quoted example',()=>{
  assert.throws(()=>auditIndexableMetadata(pages(i=>
    "<div data-example='<head>"+meta(i)+"</head>'></div>")),/missing head/);
});

test('Active head inventory ignores example titles and descriptions inside inert markup',()=>{
  const result=auditIndexableMetadata(pages(i=>'<head>'+meta(i)+
    '<!--'+meta(i)+'--><template>'+meta(i)+'</template></head>'));
  assert.equal(result.checkedPages,2);
  assert.equal(result.uniqueTitles,2);
  assert.equal(result.uniqueDescriptions,2);
});

test('Active title text excludes greater-than and closing-tag examples in quoted attributes',()=>{
  const result=auditIndexableMetadata(pages(i=>'<head>'+meta(i)
    .replace('<title>','<title data-note="first > second </title>">')
    .replace('<meta ','<meta data-note="first > second" ')+'</head>'));
  assert.equal(result.uniqueTitles,2);
});

test('Different quoted examples cannot disguise repeated actual title text',()=>{
  assert.throws(()=>auditIndexableMetadata(pages(i=>'<head>'+
    '<title data-note="first > example-'+i+'">Repeated actual title for the public inventory</title>'+
    '<meta name="description" content="'+description(i)+'"></head>')),
  /repeated document title/);
});

test('Actual duplicate canonical and JSON-LD entries remain rejected',()=>{
  assert.throws(()=>verifyIndexablePage(social()+'<link rel="canonical" href="'+ROOT+'">',ROOT),
    /expected exactly one canonical/);
  assert.throws(()=>verifyJsonLdPage(jsonld()+jsonld(),ROOT),/expected one Organization/);
});

test('JSON-LD evidence still requires a closing script tag',()=>{
  assert.throws(()=>verifyJsonLdPage(jsonld().replace(/<\/script>$/,''),ROOT),
    /expected one WebPage/);
});

test('Head inventory still requires closed HEAD and TITLE elements',()=>{
  assert.throws(()=>auditIndexableMetadata(pages(i=>'<head>'+meta(i))),/missing head/);
  assert.throws(()=>auditIndexableMetadata(pages(i=>'<head>'+meta(i)
    .replace('</title>','')+'</head>')));
});

test('Strict actual attributes still reject duplicate type, rel and description content',()=>{
  assert.throws(()=>verifyJsonLdPage(jsonld().replaceAll('type="application/ld+json"',
    'type="application/ld+json" type="application/ld+json"'),ROOT),/duplicate SEO attribute/);
  assert.throws(()=>verifyIndexablePage(social().replace('rel="canonical"',
    'rel="canonical" rel="canonical"'),ROOT),/duplicate SEO attribute/);
  assert.throws(()=>auditIndexableMetadata(pages(i=>'<head>'+meta(i).replace(
    'content="'+description(i)+'"','content="'+description(i)+'" content="duplicate"')+'</head>')),
  /duplicate SEO attribute/);
});
