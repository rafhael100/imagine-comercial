import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SyntheticTenantLeadHandoff,SYNTHETIC_CONSENT_PROOF}
  from '../src/lib/synthetic-tenant-lead-handoff.mjs';

const tenants=[
  {tenantId:'lab-tenant-alpha',serviceSlugs:['landing-pages','onepage']},
  {tenantId:'lab-tenant-beta',serviceSlugs:['gestao-google-ads']}
];
const draft=(serviceSlug='landing-pages')=>({
  name:'Maria Silva',email:'maria@example.test',phone:'+5511999999999',
  serviceSlug,details:'Preciso de uma proposta para apresentar minha empresa.',
  consent:true,honeypot:''
});
const uuid='8f1955c0-8d90-4a7a-94a6-f0f71604a823';
const submit=(tenantId='lab-tenant-alpha',serviceSlug='landing-pages')=>({
  tenantId,idempotencyKey:uuid,draft:draft(serviceSlug),
  consentProof:SYNTHETIC_CONSENT_PROOF
});

test('F77: tenant-scoped retries acknowledge duplicates without exposing contact details',()=>{
  const lab=new SyntheticTenantLeadHandoff(tenants);
  const first=lab.submitLab(submit());
  assert.equal(first.outcome,'accepted_lab_only');
  assert.equal(first.deliveryProven,false);
  assert.equal(first.deploymentAuthorized,false);
  assert.equal(first.mode,'LAB_ONLY_NO_NETWORK_NO_DURABLE_DELIVERY');
  assert.ok(Object.isFrozen(first));
  assert.equal(lab.syntheticCount('lab-tenant-alpha'),1);
  assert.equal(lab.submitLab(submit()).outcome,'duplicate_lab_ack');
  assert.equal(lab.syntheticCount('lab-tenant-alpha'),1);
  assert.throws(()=>lab.submitLab({...submit(),draft:{...draft(),details:'Pedido diferente para o mesmo UUID.'}}),
    /idempotency conflict/);
  assert.equal(lab.syntheticCount('lab-tenant-alpha'),1);
  const serialized=JSON.stringify(first);
  for(const pii of ['Maria Silva','maria@example.test','+5511999999999','Preciso de uma proposta'])
    assert.equal(serialized.includes(pii),false);
});

test('F77: independent tenant scopes use separate inboxes, with restricted services',()=>{
  const lab=new SyntheticTenantLeadHandoff(tenants);
  lab.submitLab(submit());
  const beta=lab.submitLab(submit('lab-tenant-beta','gestao-google-ads'));
  assert.equal(beta.outcome,'accepted_lab_only');
  assert.equal(lab.syntheticCount('lab-tenant-alpha'),1);
  assert.equal(lab.syntheticCount('lab-tenant-beta'),1);
  assert.throws(()=>lab.submitLab(submit('lab-tenant-beta','landing-pages')),
    /service not allowed/);
  assert.throws(()=>lab.submitLab(submit('lab-tenant-gamma')),
    /unknown lab tenant/);
  assert.equal(lab.syntheticCount('lab-tenant-beta'),1);
});

test('F77: downstream outage fails closed and does not acknowledge intake',()=>{
  const lab=new SyntheticTenantLeadHandoff(tenants);
  lab.setSimulatedDownstreamAvailability(false);
  assert.throws(()=>lab.submitLab(submit()),/downstream unavailable/);
  assert.equal(lab.syntheticCount('lab-tenant-alpha'),0);
  lab.setSimulatedDownstreamAvailability(true);
  assert.equal(lab.submitLab(submit()).outcome,'accepted_lab_only');
  assert.throws(()=>lab.setSimulatedDownstreamAvailability('yes'),/invalid lab availability/);
});

test('F77: forged consent, malformed request and unexpected PII fields rejected',()=>{
  const lab=new SyntheticTenantLeadHandoff(tenants);
  for(const value of [false,'true','accepted',null,undefined])
    assert.throws(()=>lab.submitLab({...submit(),consentProof:value}),
      /simulated consent proof/);
  assert.throws(()=>lab.submitLab({...submit(),draft:{...draft(),consent:false}}),
    /explicit contact consent/);
  assert.throws(()=>lab.submitLab({...submit(),draft:{...draft(),honeypot:'robot'}}),
    /bot trap/);
  assert.throws(()=>lab.submitLab({...submit(),draft:{...draft(),tenantId:'lab-tenant-beta'}}),
    /unsupported or missing public fields/);
  assert.throws(()=>lab.submitLab({...submit(),customerId:'123'}),
    /invalid lab handoff request/);
  assert.throws(()=>lab.submitLab({tenantId:'lab-tenant-alpha'}),
    /invalid lab handoff request/);
  assert.throws(()=>lab.submitLab(null),/invalid lab handoff request/);
  assert.throws(()=>lab.submitLab({...submit(),idempotencyKey:'maria@example.test'}),
    /invalid idempotency UUID/);
  assert.equal(lab.syntheticCount('lab-tenant-alpha'),0);
});

test('F77: policies are synthetic, restricted, unique and cannot be expanded silently',()=>{
  for(const invalid of [
    [],null,[{tenantId:'real-customer',serviceSlugs:['landing-pages']}],
    [{tenantId:'lab-tenant-alpha',serviceSlugs:['unknown-service']}],
    [{tenantId:'lab-tenant-alpha',serviceSlugs:['onepage','onepage']}],
    [...tenants,tenants[0]],
    [{...tenants[0],token:'secret'}]
  ])assert.throws(()=>new SyntheticTenantLeadHandoff(invalid),
    /invalid lab tenant/);
  const lab=new SyntheticTenantLeadHandoff(tenants);
  tenants[0].serviceSlugs.push('sites-por-assinatura');
  assert.throws(()=>lab.submitLab(submit('lab-tenant-alpha','sites-por-assinatura')),
    /service not allowed/);
  tenants[0].serviceSlugs.pop();
});

test('F77: no active public route imports the Portal handoff laboratory',()=>{
  const source=readFileSync(new URL('../src/lib/synthetic-tenant-lead-handoff.mjs',import.meta.url),'utf8');
  const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  const guard=readFileSync(new URL('../src/lib/public-intake-freeze.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|https?:\/\//);
  assert.doesNotMatch(contact,/synthetic-tenant-lead-handoff|<form\b|<input\b|fetch\s*\(/i);
  assert.match(guard,/programmatic request/);
});
