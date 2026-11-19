import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupportSession, chooseSupportOption, reviseSupportOption, buildSupportBrief
} from '../ops/faisca/support/triage.mjs';
import {
  createSupportJourney, respondSupportJourney, getSupportJourneySummary
} from '../ops/faisca/support/journey.mjs';

const choose = (session, id) => respondSupportJourney(session, { type: 'action', id });

test('R52: a missing support answer cannot be corrected as if selected', () => {
  const start = createSupportSession();
  assert.equal(reviseSupportOption(start, 'topic'), null);
  assert.equal(reviseSupportOption(start, 'service'), null);
  assert.equal(reviseSupportOption(start, 'detail'), null);
  const topic = chooseSupportOption(start, 'topic', 'billing');
  assert.equal(reviseSupportOption(topic, 'service'), null);
  assert.equal(reviseSupportOption(topic, 'detail'), null);
  const service = chooseSupportOption(topic, 'service', 'crm');
  assert.equal(reviseSupportOption(service, 'detail'), null);
  assert.equal(reviseSupportOption(service, 'service').service, null);
  assert.equal(reviseSupportOption(service, 'topic').topic, null);
  assert.equal(topic.topic, 'billing');
  assert.equal(service.service, 'crm');
});

test('R52: hidden corrections give a safe response without changing the visitor state', () => {
  const start = createSupportJourney();
  const result = choose(start, 'r10:revise:service');
  assert.match(result.reply.text, /Esta correção não está disponível/);
  assert.equal(result.session.triage.topic, null);
  assert.equal(result.session.triage.service, null);
  assert.equal(result.session.triage.detail, null);
  assert.equal(result.userText, '');
  assert.equal(result.reply.sources.length, 0);
  assert.match(getSupportJourneySummary(result.session), /RASCUNHO NÃO ENVIADO/);
});

test('R52: large or invisible action IDs fail closed and never enter the transcript', () => {
  const initial = createSupportJourney();
  const badIds = [
    'r10:topic:billing' + 'x'.repeat(100000),
    'r10:topic:billing\n',
    'r10:topic:billing\u200b',
    'r10:topic:billing ',
    'r10:topic:billing\u0000',
    'r10:topic:billing:extra'.repeat(10)
  ];
  for (const id of badIds) {
    const result = choose(initial, id);
    assert.match(result.reply.text, /Não consegui validar a opção/);
    assert.equal(result.userText, '');
    assert.equal(result.session.triage.topic, null);
    assert.doesNotMatch(result.reply.text, /100000|extra|\\u200b/);
  }
  assert.equal(initial.triage.topic, null);
});

test('R52: approved ASCII support buttons still complete, revise and restart locally', () => {
  let session = createSupportJourney();
  for (const id of ['after_sales', 'r10:topic:billing', 'r10:service:crm', 'r10:detail:invoice']) {
    const result = choose(session, id);
    assert.equal(result.reply.sources.length, 0);
    session = result.session;
  }
  const brief = buildSupportBrief(session.triage);
  assert.equal(brief.mode, 'copy_only');
  assert.equal(brief.sent, false);
  assert.equal(brief.ticketCreated, false);
  assert.equal(brief.verifiedCustomer, false);
  assert.equal(brief.operationalEffects, false);
  assert.match(brief.summary, /RASCUNHO NÃO ENVIADO/);
  const revised = choose(session, 'r10:revise:detail');
  assert.equal(revised.session.triage.detail, null);
  assert.equal(revised.session.triage.service, 'crm');
  assert.doesNotMatch(getSupportJourneySummary(revised.session), /Nota fiscal/);
  const reset = choose(revised.session, 'r10:restart');
  assert.equal(reset.session.triage.topic, null);
  assert.equal(reset.session.triage.service, null);
  assert.equal(reset.session.triage.detail, null);
  assert.match(reset.reply.text, /Nenhum ticket foi criado/);
});

test('R52: arbitrary typed content still is neither stored nor echoed', () => {
  const start = createSupportJourney();
  const secret = 'senha TEST_PRIVATE_123; CPF 111.222.333-44; contato x@example.invalid';
  const result = respondSupportJourney(start, { type: 'text', text: secret });
  assert.equal(result.userText, '[Mensagem livre não registrada]');
  assert.doesNotMatch(result.reply.text + getSupportJourneySummary(result.session), /TEST_PRIVATE_123|111\.222|example\.invalid/);
  assert.equal(result.session.triage.topic, null);
  assert.equal(result.reply.sources.length, 0);
});
