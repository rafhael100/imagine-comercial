import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services,sitePages} from '../src/data/services.mjs';
import {comparisonGroups,comparisonOptions,compareOptionsForGroup} from '../src/data/service-comparison.mjs';

test('F60 compares every real service exactly once with distinct curated criteria',()=>{
  assert.deepEqual(comparisonGroups.map(g=>g.code),['presenca','midia']);
  assert.equal(comparisonOptions.length,services.length);
  assert.deepEqual(new Set(comparisonOptions.map(x=>x.slug)),new Set(services.map(x=>x.slug)));
  assert.equal(compareOptionsForGroup('presenca').length,4);
  assert.equal(compareOptionsForGroup('midia').length,2);
  for(const item of comparisonOptions){
    assert.ok(Object.isFrozen(item));
    assert.equal(item.label,services.find(s=>s.slug===item.slug).label);
    assert.equal(item.detailHref,'/servicos/'+item.slug+'/');
    assert.equal(item.contactHref,'/contato/#'+item.slug);
    assert.ok(item.structure.length>35&&item.bestFor.length>15&&item.question.length>40);
    assert.doesNotMatch([item.bestFor,item.structure,item.question].join(' '),/\bR\$\s*\d|garantia de vendas|primeiro lugar no Google|gratuito/i);
  }
});
test('F60 unknown comparison groups reject arbitrary values rather than echo them',()=>{
  for(const value of ['','__proto__','constructor','google',42,null,{},'<script>']){
    assert.throws(()=>compareOptionsForGroup(value),/invalid public comparison group/);
  }
});
test('F60 new page is in canonical navigation catalog and linked from service directory',()=>{
  assert.ok(sitePages.some(p=>p.path==='/comparar-solucoes/'));
  const page=readFileSync(new URL('../src/pages/comparar-solucoes.astro',import.meta.url),'utf8');
  const listing=readFileSync(new URL('../src/pages/servicos/index.astro',import.meta.url),'utf8');
  const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
  assert.match(page,/comparisonGroups\.map/);
  assert.match(page,/compareOptionsForGroup/);
  assert.match(page,/<dl>/);
  assert.match(page,/<dt>/);
  assert.match(page,/detailHref/);
  assert.match(page,/contactHref/);
  assert.match(listing,/href="\/comparar-solucoes\/"/);
  assert.match(home,/href="\/comparar-solucoes\/"/);
  assert.doesNotMatch(page,/<script\b|<form\b|fetch\(|localStorage|sessionStorage|document\.cookie|innerHTML/);
});
