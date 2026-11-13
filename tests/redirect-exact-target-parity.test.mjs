import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {validateRedirectPlan,toCloudflareRedirectRules}
  from '../src/lib/redirect-plan.mjs';

const reason='Equivalência editorial candidata, pendente dos gates de SEO e release.';
const approved=(from,to)=>({from,to,status:'approved',reason});

test('F281 each of the five reviewed destinations is an exact mapping',()=>{
  const mapped=legacyUrls.filter(x=>x.status==='candidate');
  assert.equal(mapped.length,5);
  const manifest=validateRedirectPlan(mapped.map(x=>approved(x.from,x.to)));
  const lines=toCloudflareRedirectRules(manifest).split('\n');
  assert.deepEqual(lines,mapped.map(x=>x.from+' '+x.to+' 301'));
});

test('F281 valid service pages cannot be substituted as migration destinations',()=>{
  const mapped=legacyUrls.filter(x=>x.status==='candidate');
  for(const [index,source] of mapped.entries()){
    const alternative=mapped[(index+1)%mapped.length].to;
    assert.notEqual(alternative,source.to);
    const manifest=validateRedirectPlan([approved(source.from,alternative)]);
    assert.equal(manifest.active.length,1);
    assert.throws(()=>toCloudflareRedirectRules(manifest),
      /reviewed candidate target mismatch/);
  }
});

test('F281 explicit unlisted sources remain blocked independently of destination',()=>{
  const manifest=validateRedirectPlan([approved('/not-in-the-catalog.html','/contato/')]);
  assert.throws(()=>toCloudflareRedirectRules(manifest),
    /unreviewed source cannot generate a 301 rule/);
});

test('F281 default candidate and HOLD inventories remain non-deployable',()=>{
  const manifest=validateRedirectPlan(legacyUrls);
  assert.equal(manifest.active.length,0);
  assert.equal(toCloudflareRedirectRules(manifest),'');
  assert.equal(legacyUrls.filter(x=>x.status==='hold').length,22);
});
