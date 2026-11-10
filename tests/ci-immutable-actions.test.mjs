import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';

const workflowsDir=new URL('../.github/workflows/',import.meta.url);
const expected=Object.freeze({
  'actions/checkout':'3d3c42e5aac5ba805825da76410c181273ba90b1',
  'actions/setup-node':'949feb2413d6458794dcd2491c4babbbce0c15c1',
  'actions/upload-artifact':'cf430e030ddbb5b0abf93d22962f4752f3646cd9'
});
const sources=readdirSync(workflowsDir).filter(n=>/\.ya?ml$/.test(n))
  .map(name=>({name,source:readFileSync(new URL(name,workflowsDir),'utf8')}));

test('F35 — all local QA workflows pin reviewed v7 official GitHub Actions by full commit SHA',()=>{
  assert.ok(sources.length>=3,'Expected each of the three static QA workflows');
  let observed=0;
  for(const {name,source} of sources){
    const lines=source.split(/\r?\n/).filter(l=>/^[ \t]*uses:[ \t]*/.test(l));
    assert.ok(lines.length>=2,name+' lacks mandatory checkout/setup actions');
    for(const line of lines){
      const match=line.match(/^[ \t]*uses:[ \t]*([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)@([0-9a-f]{40})(?:[ \t]+#[ \t]+v7)?[ \t]*$/);
      assert.ok(match,name+': unpinned, unauthorized or malformed action');
      const [,action,sha]=match;
      assert.equal(sha,expected[action],name+': action revision not on reviewed allowlist: '+action);
      observed++;
    }
    assert.doesNotMatch(source,/^[ \t]*(?:pull_request_target|workflow_run|repository_dispatch):/m,
      name+' must not use a trigger with untrusted code and elevated credentials');
    assert.match(source,/^[ \t]*contents: read[ \t]*$/m,
      name+' must not request write privileges');
    assert.doesNotMatch(source,/^[ \t]*id-token:[ \t]*write[ \t]*$/m,
      name+' must not request production OIDC credentials');
    assert.match(source,/^[ \t]*node-version:[ \t]*['"]?22['"]?[ \t]*$/m,
      name+' must use the approved Node 22 application runtime');
  }
  assert.ok(observed>=10,'Expected pinned checkout/setup-node/upload-artifact references');
});

test('F35 — every checkout is unauthenticated after clone and SEO Engine stays at immutable code SHA',()=>{
  const validate=sources.find(x=>x.name==='validate.yml')?.source;
  assert.ok(validate,'Missing main site validation workflow');
  const steps=validate.split(/(?=^[ \t]*-[ \t]+name:)/m);
  const checkout=steps.filter(s=>s.includes('uses: actions/checkout@'));
  assert.equal(checkout.length,2,'Expected self and pinned independent SEO Engine checkout');
  for(const step of checkout){
    assert.match(step,/^[ \t]*persist-credentials:[ \t]*false[ \t]*$/m);
  }
  assert.match(validate,/ref:[ \t]*58bf1e6f31c08367792f00b6a012a01fcbe16300/,
    'Independent SEO Engine audit must not use a mutable ref');
  assert.doesNotMatch(validate,/^[ \t]*uses:[ \t]*[^\r\n]+@v[0-9]+/m,
    'Actions must never depend on a mutable major-version tag');
});
