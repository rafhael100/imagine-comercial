import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_SESSION_SCHEMA, SUPPORT_BRIEF_SCHEMA,
  createSupportSession, inspectSupportSession, getNextSupportQuestion,
  chooseSupportOption, reviseSupportOption, buildSupportBrief, getSupportOptions
} from '../ops/faisca/support/triage.mjs';

function complete(topic = 'technical', service = 'onepage', detail = 'contact_form') {
  let state = createSupportSession();
  for (const [field, value] of [['topic', topic], ['service', service], ['detail', detail]]) {
    state = chooseSupportOption(state, field, value);
    assert.ok(state, 'Closed support choice for ' + field);
  }
  return state;
}

test('R10 starts anonymous with no selected topic, service, detail or verified identity', () => {
  const session = createSupportSession();
  assert.equal(session.schema, SUPPORT_SESSION_SCHEMA);
  assert.deepEqual(inspectSupportSession(session), {
    schema: SUPPORT_SESSION_SCHEMA, topic: null, service: null, detail: null, complete: false
  });
  assert.equal(getNextSupportQuestion(session).field, 'topic');
  const brief = buildSupportBrief(session);
  assert.equal(brief.schema, SUPPORT_BRIEF_SCHEMA);
  assert.equal(brief.sent, false);
  assert.equal(brief.ticketCreated, false);
  assert.equal(brief.verifiedCustomer, false);
  assert.equal(brief.requiresAuthentication, true);
  assert.equal(brief.operationalEffects, false);
});

test('R10 only accepts exactly the next closed option, without storing arbitrary visitor text', () => {
  const initial = createSupportSession();
  assert.equal(chooseSupportOption(initial, 'service', 'onepage'), null);
  assert.equal(chooseSupportOption(initial, 'topic', 'my-secret-and-email'), null);
  assert.equal(chooseSupportOption(initial, 'topic', { type: 'billing' }), null);
  const selectedTopic = chooseSupportOption(initial, 'topic', 'billing');
  assert.equal(selectedTopic.topic, 'billing');
  assert.equal(selectedTopic.service, null);
  assert.equal(initial.topic, null);
  assert.equal(getNextSupportQuestion(selectedTopic).field, 'service');
  assert.equal(chooseSupportOption(selectedTopic, 'detail', 'invoice'), null);
  const selectedService = chooseSupportOption(selectedTopic, 'service', 'landing-page');
  assert.equal(getNextSupportQuestion(selectedService).field, 'detail');
  assert.deepEqual(getNextSupportQuestion(selectedService).options.map(option => option.value),
    ['invoice', 'payment', 'contract', 'unspecified']);
  assert.equal(chooseSupportOption(selectedService, 'detail', 'site_unavailable'), null);
  const finished = chooseSupportOption(selectedService, 'detail', 'invoice');
  assert.equal(inspectSupportSession(finished).complete, true);
  assert.equal(getNextSupportQuestion(finished), null);
  assert.equal(chooseSupportOption(finished, 'detail', 'payment'), null);
});

test('R10 supports each topic with explicit detail options and no invented operational effects', () => {
  const options = getSupportOptions();
  for (const topic of options.topics) {
    assert.ok(options.detailsByTopic[topic].includes('unspecified'));
    const session = complete(topic, 'unspecified', 'unspecified');
    const brief = buildSupportBrief(session);
    assert.match(brief.summary, /RASCUNHO NÃO ENVIADO/);
    assert.match(brief.summary, /não verificado/);
    assert.match(brief.summary, /Nenhum ticket foi aberto/);
    assert.match(brief.summary, /Portal autenticado ou canal oficial/);
    assert.equal(brief.mode, 'copy_only');
    assert.equal(brief.sent, false);
    assert.equal(brief.ticketCreated, false);
  }
});

test('R10 billing and cancellation cannot claim payment verification or cancel a service', () => {
  const billing = buildSupportBrief(complete('billing', 'onepage', 'payment'));
  assert.match(billing.summary, /não verifica quitação nem gera cobranças/);
  assert.doesNotMatch(billing.summary, /Pagamento aprovado|Boleto gerado/);
  const cancellation = buildSupportBrief(complete('cancellation', 'onepage', 'cancel_request'));
  assert.match(cancellation.summary, /não altera nem cancela serviços/);
  assert.doesNotMatch(cancellation.summary, /Cancelamento confirmado|contrato encerrado/);
});

test('R10 delivery cannot assert an order status without Portal authentication', () => {
  const brief = buildSupportBrief(complete('delivery', 'landing-page', 'progress'));
  assert.match(brief.summary, /não consulta pedidos nem informa prazos/);
  assert.match(brief.summary, /Serviço informado \(não verificado\): Landing Page/);
  assert.equal(brief.verifiedCustomer, false);
});

test('R10 technical triage refuses to request secrets and does not claim a support ticket', () => {
  const brief = buildSupportBrief(complete('technical', 'onepage', 'contact_form'));
  assert.match(brief.summary, /Não envie senhas, tokens, acessos/);
  assert.match(brief.summary, /Nenhum ticket foi aberto/);
  assert.equal(brief.ticketCreated, false);
  assert.equal('email' in brief, false);
  assert.equal('phone' in brief, false);
  assert.equal('customerId' in brief, false);
});

test('R10 revisions clear only the chosen field and dependent information', () => {
  const initial = complete('technical', 'onepage', 'visual');
  const reviseDetail = reviseSupportOption(initial, 'detail');
  assert.equal(reviseDetail.topic, 'technical');
  assert.equal(reviseDetail.service, 'onepage');
  assert.equal(reviseDetail.detail, null);
  assert.equal(getNextSupportQuestion(reviseDetail).field, 'detail');
  const reviseService = reviseSupportOption(initial, 'service');
  assert.equal(reviseService.topic, 'technical');
  assert.equal(reviseService.service, null);
  assert.equal(reviseService.detail, null);
  const reviseTopic = reviseSupportOption(initial, 'topic');
  assert.equal(reviseTopic.topic, null);
  assert.equal(reviseTopic.service, null);
  assert.equal(reviseTopic.detail, null);
  assert.equal(reviseSupportOption(initial, 'email'), null);
  assert.equal(initial.detail, 'visual');
});

test('R10 sessions are immutable, opaque and do not accept forged or cloned state', () => {
  const session = createSupportSession();
  assert.equal(Object.isFrozen(session), true);
  assert.equal(inspectSupportSession({ ...session }), null);
  assert.equal(chooseSupportOption({ ...session }, 'topic', 'billing'), null);
  assert.equal(reviseSupportOption({ ...session }, 'topic'), null);
  assert.equal(buildSupportBrief({ ...session }), null);
  let reads = 0;
  const forged = {};
  Object.defineProperty(forged, 'topic', { enumerable: true, get() { reads++; return 'billing'; } });
  assert.equal(inspectSupportSession(forged), null);
  assert.equal(reads, 0);
});

test('R10 parallel anonymous sessions do not share service, issue type or state', () => {
  const a = complete('technical', 'onepage', 'site_unavailable');
  const b = complete('billing', 'crm', 'invoice');
  assert.equal(a.topic, 'technical');
  assert.equal(b.topic, 'billing');
  assert.notEqual(buildSupportBrief(a).summary, buildSupportBrief(b).summary);
  assert.doesNotMatch(buildSupportBrief(a).summary, /Imagine CRM|Nota fiscal/);
  assert.doesNotMatch(buildSupportBrief(b).summary, /Página não abre|Site Onepage/);
  assert.equal(a.service, 'onepage');
});

test('R10 no state ever includes contact details, order IDs or a claim of support creation', () => {
  for (const topic of getSupportOptions().topics) {
    const session = complete(topic, 'unspecified', 'unspecified');
    const representation = JSON.stringify({ session, brief: buildSupportBrief(session) });
    assert.doesNotMatch(representation, /emailAddress|phoneNumber|orderId|customerId|tenantId|ticketId|ticketCreated":true/);
  }
});
