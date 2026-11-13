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

test('F156: seven visual fields mapped; anti-bot and live intake remain unverified',()=>{
  const assessment=reviewLegacyBudgetPreviewParity(html);
  assert.equal(assessment.schema,'imagine.comercial.legacy-budget-ui-parity.v1');
  assert.equal(assessment.visibleFields,7);
  assert.equal(assessment.observedLegacyFields,7);
  assert.deepEqual(assessment.unresolvedFields,[]);
  assert.equal(assessment.fields.filter(x=>x.status==='VISIBLE_PREVIEW_CONTROL_ONLY').length,7);
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

test('F156: matching seven visible fields cannot claim functional parity or bot protection',()=>{
  const assessment=reviewLegacyBudgetPreviewParity(html);
  assert.deepEqual(assessment.unresolvedFields,[]);
  assert.match(html,/id="lead-challenge"/);
  assert.match(html,/Este campo não verifica sua resposta nem oferece proteção contra robôs/);
  assert.match(html,/<button type="submit" disabled /);
  assert.equal(assessment.antiBotOperationallyVerified,false);
  assert.equal(assessment.legacyDeliveryVerified,false);
  assert.equal(assessment.legacyContactIntakeParityApproved,false);
  assert.equal(assessment.deploymentAuthorized,false);
});

test('F83: fake IDs, scripts and arbitrary HTML are not accepted as valid mapped controls',()=>{
  const manipulated=html.replace('id="lead-email"','id="lead-email-removed"');
  assert.deepEqual(reviewLegacyBudgetPreviewParity(manipulated).unresolvedFields,
    ['email']);
  for(const bad of [null,{},'',123,'a'.repeat(500001)])
    assert.throws(()=>reviewLegacyBudgetPreviewParity(bad),/invalid private preview/);
});

test('F84: hidden, disabled or aria-hidden controls do not fake visual parity',()=>{
  for(const decoration of ['hidden','disabled','type="hidden"','aria-hidden="true"',
                           'style="display:none"','style="visibility:hidden"']){
    const withHidden=html.replace('id="lead-role"', 'id="lead-role" '+decoration);
    const result=reviewLegacyBudgetPreviewParity(withHidden);
    assert.deepEqual(result.unresolvedFields,['role'],decoration);
    assert.equal(result.deploymentAuthorized,false);
  }
});

test('F156: missing or concealed arithmetic field breaks visual mapping',()=>{
  for(const decoration of ['disabled','hidden','aria-hidden="true"','style="display:none"']){
    const removed=html.replace('id="lead-challenge"','id="lead-challenge" '+decoration);
    const result=reviewLegacyBudgetPreviewParity(removed);
    assert.deepEqual(result.unresolvedFields,['challenge'],decoration);
    assert.equal(result.visibleFields,6);
    assert.equal(result.deploymentAuthorized,false);
  }
});

test('F156: F43 CLI reports complete visual mapping but still blocks operational release',()=>{
  const report=JSON.parse(renderReadinessReport());
  assert.ok(report.blockers.includes('legacy-contact-intake-parity'));
  assert.equal(report.approval,'NOT_AUTHORIZED');
  assert.equal(report.deploymentPerformed,false);
  assert.deepEqual(report.legacyContactIntake.unresolvedFields,[]);
  assert.equal(report.legacyContactIntake.visibleFields,7);
  assert.equal(report.legacyContactIntake.antiBotOperationallyVerified,false);
  assert.equal(report.legacyContactIntake.deploymentAuthorized,false);
  assert.equal(report.legacyContactIntake.legacyContactIntakeParityApproved,false);
});


test('F264: duplicate field IDs never satisfy visual parity, including hidden decoys',()=>{
  for(const field of ['lead-name','lead-role','lead-email','lead-phone','lead-mobile','lead-details','lead-challenge']){
    const key=LEGACY_BUDGET_FIELDS.find(item=>item.previewId===field).key;
    for(const duplicate of [
      '<input id="'+field+'" type="text">',
      '<input id="'+field+'" type="hidden">',
      '<input id="'+field+'" hidden>',
      '<textarea id="'+field+'" disabled></textarea>'
    ]){
      const crafted=html.replace('</fieldset>',duplicate+'</fieldset>');
      const result=reviewLegacyBudgetPreviewParity(crafted);
      assert.deepEqual(result.unresolvedFields,[key],field);
      assert.equal(result.visibleFields,6);
      assert.equal(result.legacyContactIntakeParityApproved,false);
      assert.equal(result.deploymentAuthorized,false);
    }
  }
});
test('F264: inert fields and unquoted hidden inputs do not count as visible controls',()=>{
  for(const decoration of ['inert','type=hidden','aria-hidden=true']){
    const crafted=html.replace('id="lead-role"','id="lead-role" '+decoration);
    const result=reviewLegacyBudgetPreviewParity(crafted);
    assert.deepEqual(result.unresolvedFields,['role'],decoration);
  }
});


test('F264: removed, miswired or duplicate labels never count as accessible mapping',()=>{
  const wrong=html.replace('for="lead-email"','for="nonexistent-email"');
  assert.deepEqual(reviewLegacyBudgetPreviewParity(wrong).unresolvedFields,['email']);
  const duplicate=html.replace('</fieldset>',
    '<label for="lead-email">Etiqueta repetida</label></fieldset>');
  assert.deepEqual(reviewLegacyBudgetPreviewParity(duplicate).unresolvedFields,['email']);
  const removed=html.replace('<label for="lead-phone">Telefone (regra final a definir)</label>','');
  assert.deepEqual(reviewLegacyBudgetPreviewParity(removed).unresolvedFields,['telephone']);
});
