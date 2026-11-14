import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {sitePages} from '../src/data/services.mjs';

const map=new Map(legacyUrls.map(x=>[x.from,x]));
const known=new Set(sitePages.map(x=>x.path));

test('legacy service navigation has eight individually documented entries',()=>{
  const paths=[
    'criacao-de-sites-institucional.html','criacao-de-loja-virtual.html',
    'google-ads-anuncios.html','facebook-instagram-ads.html',
    'youtube-ads-anuncios.html','linkedin-ads-anuncios.html',
    'marketplace-amazon.html','marketplace-mercado-livre.html'
  ];
  for(const name of paths)assert.ok(map.has('/o-que-fazemos/'+name),name);
  assert.equal(paths.length,8);
});
test('only three comparable old offers are candidates; unrelated offers remain held',()=>{
  const expected={
    'criacao-de-sites-institucional.html':'/servicos/criacao-de-sites/',
    'google-ads-anuncios.html':'/servicos/gestao-google-ads/',
    'facebook-instagram-ads.html':'/servicos/gestao-meta-ads/'
  };
  for(const [old,target] of Object.entries(expected)){
    const entry=map.get('/o-que-fazemos/'+old);
    assert.equal(entry.status,'candidate');
    assert.equal(entry.to,target);
    assert.ok(known.has(target));
  }
  for(const name of ['criacao-de-loja-virtual.html','youtube-ads-anuncios.html',
    'linkedin-ads-anuncios.html','marketplace-amazon.html','marketplace-mercado-livre.html']){
    const entry=map.get('/o-que-fazemos/'+name);
    assert.equal(entry.status,'hold');
    assert.equal(entry.to,null);
  }
  assert.ok(legacyUrls.every(x=>x.status!=='approved'));
});
test('privacy, english and former customer portfolio URLs stay held',()=>{
  for(const path of ['/clientes.html','/en-us/','/en-us/customers.html',
    '/en-us/contact-us.html','/en-us/termos-de-uso.html']){
    assert.equal(map.get(path)?.status,'hold');
  }
});

test('F67: eight additional historical paths require individual HOLD and never auto-redirect',()=>{
  const extra=[
    '/trabalhe-conosco.html',
    '/component/imaginecontato/criacao-de-sites-em-fortaleza.html',
    '/en-us/services/criacao-de-loja-virtual.html',
    '/en-us/services/facebook-instagram-ads.html',
    '/en-us/services/google-ads-anuncios.html',
    '/en-us/services/linkedin-ads-anuncios.html',
    '/en-us/services/marketplace-amazon.html',
    '/en-us/services/marketplace-mercado-livre.html'
  ];
  assert.equal(extra.length,8);
  assert.equal(new Set(extra).size,extra.length);
  for(const path of extra){
    const entry=map.get(path);
    assert.ok(entry,path+' must be in legacy inventory');
    assert.equal(entry.status,'hold');
    assert.equal(entry.to,null);
    assert.ok(entry.reason.length>=45);
  }
  assert.equal(legacyUrls.filter(x=>x.status==='candidate').length,5);
  assert.equal(legacyUrls.filter(x=>x.status==='hold').length,22);
  assert.ok(legacyUrls.every(x=>x.status!=='approved'));
});
