import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyJsonLdPage} from '../src/lib/jsonld-output-contract.mjs';

const ROOT='https://imaginecomunicacao.com.br/';
const ORG=ROOT+'#organization';
const schema=(canonical,{article=false,service=false,breadcrumb=false}={})=>{
  const docs=[
    {'@context':'https://schema.org','@type':'Organization',
      '@id':ORG,url:ROOT},
    {'@context':'https://schema.org','@type':'WebPage',
      '@id':canonical+'#webpage',url:canonical,inLanguage:'pt-BR'}
  ];
  if(article)docs.push({'@context':'https://schema.org','@type':'Article',
    '@id':canonical+'#article',url:canonical,mainEntityOfPage:canonical,
    headline:'Guia informativo de marketing para empresas'});
  if(service)docs.push({'@context':'https://schema.org','@type':'Service',
    '@id':canonical+'#service',url:canonical,mainEntityOfPage:canonical,
    name:'Criação de sites',provider:{'@id':ORG}});
  if(breadcrumb)docs.push({'@context':'https://schema.org',
    '@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,item:ROOT},
      {'@type':'ListItem',position:2,item:canonical}
    ]});
  return '<!doctype html><html lang="pt-BR"><head>'+
    docs.map(x=>'<script type="application/ld+json">'+JSON.stringify(x)+'</script>').join('')+
    '</head><body></body></html>';
};

test('F140 accepts one truthful Organization and WebPage per canonical page',()=>{
  assert.equal(verifyJsonLdPage(schema(ROOT),ROOT),true);
  const url=ROOT+'servicos/criacao-de-sites/';
  assert.equal(verifyJsonLdPage(schema(url,{service:true,breadcrumb:true}),url),true);
  const article=ROOT+'conteudos/landing-page-ou-site/';
  assert.equal(verifyJsonLdPage(schema(article,{article:true,breadcrumb:true}),article),true);
});
test('F140 catches article and service markup on the wrong page kind',()=>{
  const article=ROOT+'conteudos/landing-page-ou-site/';
  const service=ROOT+'servicos/criacao-de-sites/';
  assert.throws(()=>verifyJsonLdPage(schema(article),article),/unexpected Article markup/);
  assert.throws(()=>verifyJsonLdPage(schema(service),service),/unexpected Service markup/);
  assert.throws(()=>verifyJsonLdPage(schema(ROOT,{service:true}),ROOT),
    /unexpected Service markup/);
});
test('F140 rejects canonical ID drift, fake publisher and breadcrumb divergence',()=>{
  const url=ROOT+'servicos/criacao-de-sites/';
  assert.throws(()=>verifyJsonLdPage(schema(url,{service:true}).replace(
    url+'#service','https://evil.invalid/#service'),url),/Service ID mismatch/);
  assert.throws(()=>verifyJsonLdPage(schema(url,{service:true}).replace(
    ORG,'https://other.invalid/'),url),/Organization ID mismatch/);
  assert.throws(()=>verifyJsonLdPage(schema(url,{service:true,breadcrumb:true}).replace(
    '"position":2','"position":9'),url),/Expected values to be strictly equal/);
  assert.throws(()=>verifyJsonLdPage(schema(url,{service:true}),ROOT),
    /WebPage URL mismatch/);
});
test('F140 rejects duplicate or unknown structured-data entities',()=>{
  const json={'@context':'https://schema.org','@type':'WebPage',
    '@id':ROOT+'#webpage',url:ROOT,inLanguage:'pt-BR'};
  const duplicate=schema(ROOT).replace('</head>',
    '<script type="application/ld+json">'+JSON.stringify(json)+'</script></head>');
  assert.throws(()=>verifyJsonLdPage(duplicate,ROOT),/expected one WebPage/);
  const unknown=schema(ROOT).replace('</head>',
    '<script type="application/ld+json">'+
    JSON.stringify({'@context':'https://schema.org','@type':'PriceSpecification'})+
    '</script></head>');
  assert.throws(()=>verifyJsonLdPage(unknown,ROOT),/unknown JSON-LD entity/);
});
