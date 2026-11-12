import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCanonicalStagingEvidence} from '../src/lib/canonical-staging-evidence.mjs';
const valid=()=>[
  {origin:'http://imaginecomunicacao.com.br',status:301,location:'https://imaginecomunicacao.com.br/',tlsValid:null},
  {origin:'http://www.imaginecomunicacao.com.br',status:301,location:'https://imaginecomunicacao.com.br/',tlsValid:null},
  {origin:'https://www.imaginecomunicacao.com.br',status:301,location:'https://imaginecomunicacao.com.br/',tlsValid:true},
  {origin:'https://imaginecomunicacao.com.br',status:200,location:null,tlsValid:true}
];
test('F226 synthetic four host-root observations match desired policy without release permission',()=>{
  const result=reviewCanonicalStagingEvidence(valid());
  assert.equal(result.reviewPassed,true);
  assert.equal(result.redirectRulesAuthorized,0);
  assert.equal(result.productionAuthorized,false);
  assert.equal(result.dnsChangeAuthorized,false);
  assert.equal(result.findings.length,4);
  assert.ok(Object.isFrozen(result.findings));
});
test('F226 fails closed for incorrect redirect, chain, status, or TLS',()=>{
  for(const [index,patch] of [
    [0,{status:302}],[1,{location:'https://www.imaginecomunicacao.com.br/'}],
    [2,{tlsValid:false}],[3,{status:301,location:'https://imaginecomunicacao.com.br/'}],
    [1,{location:'https://imaginecomunicacao.com.br/contato/'}],
    [0,{tlsValid:true}]
  ]){
    const rows=valid();rows[index]={...rows[index],...patch};
    const report=reviewCanonicalStagingEvidence(rows);
    assert.equal(report.reviewPassed,false);
    assert.equal(report.productionAuthorized,false);
  }
});
test('F226 rejects malformed, incomplete, spoofed, or duplicate evidence',()=>{
  const scenarios=[
    valid().slice(1),
    [...valid().slice(0,3),valid()[0]],
    valid().map((x,i)=>i===0?{...x,origin:'http://evil.example'}:x),
    valid().map((x,i)=>i===0?{...x,approved:true}:x),
    valid().map((x,i)=>i===0?{...x,location:42}:x),
    valid().map((x,i)=>i===0?{...x,status:NaN}:x),
    valid().map((x,i)=>i===0?{...x,origin:'http://www.imaginecomunicacao.com.br:80'}:x)
  ];
  for(const rows of scenarios)assert.throws(()=>reviewCanonicalStagingEvidence(rows));
  assert.throws(()=>reviewCanonicalStagingEvidence(null));
});
