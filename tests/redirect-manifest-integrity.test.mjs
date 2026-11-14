import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRedirectPlan,toCloudflareRedirectRules}
  from '../src/lib/redirect-plan.mjs';

const approved={from:'/fale-conosco.html',to:'/contato/',status:'approved',
  reason:'Equivalência editorial precisa de revisão independente.'};

test('F279 a vetted in-process plan still renders safe review-only 301 text',()=>{
  const plan=validateRedirectPlan([approved]);
  assert.equal(toCloudflareRedirectRules(plan),'/fale-conosco.html /contato/ 301');
  assert.equal(toCloudflareRedirectRules(validateRedirectPlan([])),'');
});

test('F279 forged unvalidated active arrays cannot inject extra redirect rules',()=>{
  const forged={
    active:[{from:'/fale-conosco.html\n/evil /contato/',to:'/contato/',statusCode:301}]
  };
  assert.throws(()=>toCloudflareRedirectRules(forged),/validated manifest required/);
  assert.throws(()=>toCloudflareRedirectRules({active:[]}),/validated manifest required/);
  assert.throws(()=>toCloudflareRedirectRules(Object.freeze(forged)),
    /validated manifest required/);
});

test('F279 serialized or spread copies of a plan must be revalidated',()=>{
  const plan=validateRedirectPlan([approved]);
  for(const replica of [
    JSON.parse(JSON.stringify(plan)),
    {...plan},
    Object.freeze({...plan}),
    Object.assign(Object.create(null),plan)
  ])assert.throws(()=>toCloudflareRedirectRules(replica),
    /validated manifest required/);
  assert.equal(toCloudflareRedirectRules(plan),
    '/fale-conosco.html /contato/ 301');
});

test('F279 caller cannot tamper with a validated frozen redirect plan',()=>{
  const plan=validateRedirectPlan([approved]);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.active));
  assert.ok(Object.isFrozen(plan.active[0]));
  assert.throws(()=>{plan.active[0].to='/redirected-evil/';},TypeError);
  assert.equal(toCloudflareRedirectRules(plan),'/fale-conosco.html /contato/ 301');
});
