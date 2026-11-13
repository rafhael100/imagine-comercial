import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {validateRedirectPlan,toCloudflareRedirectRules} from '../src/lib/redirect-plan.mjs';

const reason='Esta regra precisa de revisão editorial e SEO independente.';
test('F278 all inventoried HOLD routes refuse unapproved 301 elevation',()=>{
  const held=legacyUrls.filter(x=>x.status==='hold');
  assert.equal(held.length,22);
  for(const route of held){
    for(const status of ['candidate','approved']){
      const manipulated={...route,to:'/contato/',status,reason};
      assert.throws(()=>validateRedirectPlan([manipulated]),
        /HOLD route cannot become a redirect/,route.from);
    }
  }
});

test('F278 known candidates remain simulated but not automatically active',()=>{
  const candidates=legacyUrls.filter(x=>x.status==='candidate');
  assert.equal(candidates.length,5);
  const result=validateRedirectPlan(legacyUrls);
  assert.equal(result.active.length,0);
  assert.equal(toCloudflareRedirectRules(result),'');
  for(const entry of candidates){
    const review=validateRedirectPlan([entry]);
    assert.equal(review.active.length,0);
  }
});

test('F278 independent operator text alone cannot bypass known HOLD status',()=>{
  const known=legacyUrls.find(x=>x.status==='hold');
  assert.throws(()=>validateRedirectPlan([{
    from:known.from,to:'/servicos/criacao-de-sites/',status:'approved',
    reason:'A aprovação final já está confirmada por todas as áreas.'
  }]),/HOLD route cannot become a redirect/);
  assert.equal(validateRedirectPlan(legacyUrls).entries.length,27);
});
