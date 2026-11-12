import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from '../src/data/services.mjs';
import {comparisonOptions} from '../src/data/service-comparison.mjs';
import {curatedServiceComparisons} from '../src/data/service-comparison-pairs.mjs';
import {decodeReviewedComparisonFragment} from '../src/data/reviewed-comparison-fragment.mjs';

test('F195 each published service has two distinct canonical comparison deep-links',()=>{
  for(const service of services){
    const links=curatedServiceComparisons(service.slug);
    assert.equal(links.length,2);
    assert.ok(Object.isFrozen(links));
    assert.equal(new Set(links.map(x=>x.href)).size,2);
    for(const link of links){
      assert.ok(Object.isFrozen(link));
      const url=new URL(link.href,'https://imaginecomunicacao.com.br');
      assert.equal(url.pathname,'/comparar-solucoes/');
      const pair=decodeReviewedComparisonFragment(url.hash);
      assert.ok(pair?.includes(service.slug));
      assert.ok(pair?.includes(link.slug));
      assert.notEqual(link.slug,service.slug);
      assert.equal(link.label,comparisonOptions.find(x=>x.slug===link.slug).label);
      assert.equal(url.search,'');
    }
  }
});
test('F195 unknown service slugs and prototype names fail closed',()=>{
  for(const invalid of [null,undefined,42,{},'','constructor','__proto__',
    'onepage?token=secret','https://evil.invalid','../../contato'])
    assert.throws(()=>curatedServiceComparisons(invalid),/unreviewed service/);
});
