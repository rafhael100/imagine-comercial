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
