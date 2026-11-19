import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupportJourney, respondSupportJourney, getSupportJourneySummary } from '../ops/faisca/support/journey.mjs';

const choose = (session, id) => respondSupportJourney(session, { type: 'action', id });
const ids = (result) => result.reply.actions.map(action => action.id);

test('R54: a selected topic can be corrected during service selection', () => {
  const first = choose(createSupportJourney(), 'r10:topic:billing');
  assert.equal(first.session.triage.topic, 'billing');
  assert.ok(ids(first).includes('r10:revise:topic'));
  assert.ok(!ids(first).includes('r10:revise:service'));
  assert.ok(!ids(first).includes('r10:revise:detail'));
  const corrected = choose(first.session, 'r10:revise:topic');
  assert.equal(corrected.session.triage.topic, null);
  assert.equal(corrected.session.triage.service, null);
  assert.equal(corrected.session.triage.detail, null);
  assert.ok(ids(corrected).includes('r10:topic:technical'));
  assert.ok(!ids(corrected).includes('r10:revise:topic'));
});

test('R54: correcting the service before detail preserves topic and clears dependent answers', () => {
  const first = choose(createSupportJourney(), 'r10:topic:billing');
  const second = choose(first.session, 'r10:service:crm');
  assert.equal(second.session.triage.service, 'crm');
  assert.ok(ids(second).includes('r10:revise:topic'));
  assert.ok(ids(second).includes('r10:revise:service'));
  assert.ok(!ids(second).includes('r10:revise:detail'));
  const corrected = choose(second.session, 'r10:revise:service');
  assert.equal(corrected.session.triage.topic, 'billing');
  assert.equal(corrected.session.triage.service, null);
  assert.equal(corrected.session.triage.detail, null);
  assert.ok(ids(corrected).includes('r10:service:onepage'));
  assert.match(getSupportJourneySummary(corrected.session), /RASCUNHO NÃO ENVIADO/);
});

test('R54: forged correction of an unanswered field is rejected and does not change the triage', () => {
  const start = createSupportJourney();
  const invalid = choose(start, 'r10:revise:service');
  assert.equal(invalid.session.triage.topic, null);
  assert.equal(invalid.session.triage.service, null);
  assert.match(invalid.reply.text, /correção não está disponível/);
  assert.equal(invalid.reply.sources.length, 0);
  assert.ok(!ids(invalid).includes('r10:revise:service'));
});

test('R54: correcting an earlier answer never creates a ticket or exports personal data', () => {
  const topic = choose(createSupportJourney(), 'r10:topic:billing');
  const service = choose(topic.session, 'r10:service:crm');
  const corrected = choose(service.session, 'r10:revise:topic');
  const summary = getSupportJourneySummary(corrected.session);
  assert.match(summary, /Nenhum ticket foi aberto/);
  assert.match(summary, /RASCUNHO NÃO ENVIADO/);
  assert.doesNotMatch(summary, /Imagine CRM/);
  assert.deepEqual(corrected.reply.sources, []);
  assert.equal(corrected.session.triage.service, null);
});
