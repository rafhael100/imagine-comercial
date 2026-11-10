import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  LEGACY_BUDGET_FORM_EVIDENCE,
  LEGACY_BUDGET_FIELDS,
  reviewLegacyBudgetPreviewParity
} from '../src/lib/legacy-budget-parity.mjs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';

const html=readFileSync(new URL('./fixtures/private-contact-form-preview.html',import.meta.url),'utf8');

test('F83: public legacy quote form inventory retains all seven visible fields',()=>{
  assert.equal(LEGACY_BUDGET_FORM_EVIDENCE.url,
    'https://www.imaginecomunicacao.com.br/fale-conosco.html');
  assert.equal(LEGACY_BUDGET_FORM_EVIDENCE.evidenceType,'PUBLIC_RENDERED_UI_ONLY');
  assert.equal(LEGACY_BUDGET_FORM_EVIDENCE.submissionOutcome,'NOT_TESTED');
  assert.deepEqual(LEGACY_BUDGET_FIELDS.map(x=>x.legacyLabel),[
    'Nome','Cargo','Email','Telefone','Celular','Mensagem','Verificação aritmética'
  ]);
  assert.equal(new Set(LEGACY_BUDGET_FIELDS.map(x=>x.key)).size,7);
  assert.ok(LEGACY_BUDGET_FIELDS.every(Object.isFrozen));
});

test('F83: private preview has six visible mappings, with one explicit anti-bot gap',()=>{
  const assessment=reviewLegacyBudgetPreviewParity(html);
  assert.equal(assessment.schema,'imagine.comercial.legacy-budget-ui-parity.v1');
  assert.equal(assessment.visibleFields,6);
  assert.equal(assessment.observedLegacyFields,7);
  assert.deepEqual(assessment.unresolvedFields,['challenge']);
  assert.equal(assessment.fields.filter(x=>x.status==='VISIBLE_PREVIEW_CONTROL_ONLY').length,6);
  assert.equal(assessment.legacyContactIntakeParityApproved,false);
  assert.equal(assessment.deploymentAuthorized,false);
  assert.equal(assessment.legacyDeliveryVerified,false);
  assert.equal(assessment.portalCrmDeliveryVerified,false);
  assert.equal(assessment.antiBotOperationallyVerified,false);
  assert.equal(assessment.legalReviewCompleted,false);
  assert.ok(Object.isFrozen(assessment));
  assert.ok(Object.isFrozen(assessment.fields));
  assert.ok(Object.isFrozen(assessment.unresolvedFields));
});

test('F83: even if preview shows all legacy fields it cannot claim operational parity',()=>{
  const decorated=html.replace('</fieldset>',
    '<input id="lead-role" type="text">'+
    '<input id="lead-mobile" type="tel">'+
    '<input id="lead-challenge" type="text"></fieldset>');
  // Inventory itself deliberately does not auto-map missing fields.
  const assessment=reviewLegacyBudgetPreviewParity(decorated);
  assert.deepEqual(assessment.unresolvedFields,['role','mobile','challenge']);
  assert.equal(assessment.legacyContactIntakeParityApproved,false);
  assert.equal(assessment.deploymentAuthorized,false);
});

test('F83: fake IDs, scripts and arbitrary HTML are not accepted as valid mapped controls',()=>{
  const manipulated=html.replace('id="lead-email"','id="lead-email-removed"');
  assert.deepEqual(reviewLegacyBudgetPreviewParity(manipulated).unresolvedFields,
    ['email','challenge']);
  for(const bad of [null,{},'',123,'a'.repeat(500001)])
    assert.throws(()=>reviewLegacyBudgetPreviewParity(bad),/invalid private preview/);
});

test('F83: F43 CLI reports precise legacy gaps but still blocks release',()=>{
  const report=JSON.parse(renderReadinessReport());
  assert.ok(report.blockers.includes('legacy-contact-intake-parity'));
  assert.equal(report.approval,'NOT_AUTHORIZED');
  assert.equal(report.deploymentPerformed,false);
  assert.deepEqual(report.legacyContactIntake.unresolvedFields,
    ['role','mobile','challenge']);
  assert.equal(report.legacyContactIntake.deploymentAuthorized,false);
  assert.equal(report.legacyContactIntake.legacyContactIntakeParityApproved,false);
});
