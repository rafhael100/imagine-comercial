import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLaunchReadiness,RELEASE_GATES}
  from '../src/lib/launch-readiness.mjs';

const item=()=>({
  id:RELEASE_GATES[0],status:'reviewed',
  evidenceUrls:['https://github.com/rafhael100/imagine-comercial/pull/355']
});

test('F294 ordinary and frozen readiness metadata remain review-only',()=>{
  const gates=[Object.freeze(item())];
  const r=evaluateLaunchReadiness(Object.freeze({gates,requestedTarget:'staging'}));
  assert.equal(r.reviewedCount,1);
  assert.equal(r.deploymentAuthorized,false);
  assert.equal(r.deploymentPerformed,false);
  assert.equal(r.state,'BLOCKED_REVIEW_ONLY');
});

test('F294 no release metadata getter may execute, including root inputs',()=>{
  let called=0;
  const root={gates:[item()]};
  Object.defineProperty(root,'requestedTarget',{enumerable:true,
    get(){called++;throw Error('PRIVATE_F294_ROOT_GETTER');}
  });
  assert.throws(()=>evaluateLaunchReadiness(root),/invalid review input/);
  for(const field of ['id','status','evidenceUrls']){
    const gate=item();
    Object.defineProperty(gate,field,{enumerable:true,
      get(){called++;throw Error('PRIVATE_F294_GATE_GETTER');}
    });
    assert.throws(()=>evaluateLaunchReadiness({gates:[gate]}),
      /invalid, duplicate or unsupported gate record/);
  }
  const list=item();
  Object.defineProperty(list.evidenceUrls,'0',{enumerable:true,
    get(){called++;throw Error('PRIVATE_F294_EVIDENCE_GETTER');}
  });
  assert.throws(()=>evaluateLaunchReadiness({gates:[list]}),
    /invalid, duplicate or unsupported gate record/);
  assert.equal(called,0);
});

test('F294 hidden fields, symbols and inherited gate fields are rejected',()=>{
  for(const mutation of [
    x=>Object.defineProperty(x,'adminApproved',{value:true,enumerable:false}),
    x=>{x[Symbol('adminApproved')]=true;},
    x=>Object.setPrototypeOf(x,{status:'reviewed'}),
    x=>{delete x.id;}
  ]){
    const gate=item();mutation(gate);
    assert.throws(()=>evaluateLaunchReadiness({gates:[gate]}),
      /invalid, duplicate or unsupported gate record/);
  }
  const extra={gates:[item()]};
  Object.defineProperty(extra,'private',{value:true,enumerable:false});
  assert.throws(()=>evaluateLaunchReadiness(extra),/invalid review input/);
});

test('F294 decorated and sparse gate/evidence arrays cannot bypass validation',()=>{
  const sparse=new Array(2);
  sparse[1]=item();
  const decorated=[item()];
  Object.defineProperty(decorated,'approved',{value:true});
  const extraSymbol=[item()];
  extraSymbol[Symbol('gate')]=true;
  const inherited=[item()];
  Object.setPrototypeOf(inherited,Object.create(Array.prototype));
  for(const gates of [sparse,decorated,extraSymbol,inherited])
    assert.throws(()=>evaluateLaunchReadiness({gates}),/invalid gate inventory/);
  const gate=item();
  Object.defineProperty(gate.evidenceUrls,'secret',{value:'PRIVATE_F294'});
  assert.throws(()=>evaluateLaunchReadiness({gates:[gate]}),
    /invalid, duplicate or unsupported gate record/);
});
