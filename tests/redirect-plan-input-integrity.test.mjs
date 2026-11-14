import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {validateRedirectPlan,toCloudflareRedirectRules}
  from '../src/lib/redirect-plan.mjs';

const entry=()=>({
  from:'/fale-conosco.html',
  to:'/contato/',
  status:'candidate',
  reason:'Equivalência de conteúdo exige revisão independente.'
});

test('F282 existing public redirect inventory is still supported',()=>{
  const actual=validateRedirectPlan(legacyUrls);
  assert.equal(actual.entries.length,27);
  assert.equal(actual.active.length,0);
  assert.equal(toCloudflareRedirectRules(actual),'');
  assert.equal(validateRedirectPlan([entry()]).entries.length,1);
});

test('F282 reject accessor fields without invoking private getters',()=>{
  let calls=0;
  for(const key of ['from','to','status','reason']){
    const draft=entry();
    Object.defineProperty(draft,key,{
      enumerable:true,configurable:true,
      get(){calls++;throw Error('PRIVATE-F282-GETTER');}
    });
    try{
      validateRedirectPlan([draft]);assert.fail('getter should fail');
    }catch(error){
      assert.match(String(error),/own-data redirect object required/);
      assert.doesNotMatch(String(error),/PRIVATE-F282/);
    }
  }
  assert.equal(calls,0);
});

test('F282 disallow hidden, symbolic, inherited and missing redirect state',()=>{
  const hidden=entry();
  Object.defineProperty(hidden,'secret',{value:'PRIVATE-F282',enumerable:false});
  const symbol=entry();symbol[Symbol('approval')]=true;
  const inherited=Object.assign(Object.create({approved:true}),entry());
  const missing=entry();delete missing.reason;
  const extra={...entry(),approved:true};
  const nullPrototype=Object.assign(Object.create(null),entry());
  for(const value of [hidden,symbol,inherited,missing,extra,nullPrototype])
    assert.throws(()=>validateRedirectPlan([value]),
      /own-data redirect object required/);
});

test('F282 frozen, plain data entries do not lose normal validation behavior',()=>{
  const valid=Object.freeze(entry());
  assert.equal(validateRedirectPlan([valid]).entries[0].status,'candidate');
  const unsafe={...entry(),from:'/not-in-inventory.html',status:'approved'};
  const plan=validateRedirectPlan([unsafe]);
  assert.throws(()=>toCloudflareRedirectRules(plan),
    /unreviewed source cannot generate a 301 rule/);
});
