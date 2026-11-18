import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, respondJourney, getJourneySummary, JOURNEY_VERSION } from '../ops/faisca/journey/state.mjs';
import { getGroundedAnswer, findGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const text = (session, message) => respondJourney(session, { type: 'text', text: message });
const act = (session, id) => respondJourney(session, { type: 'action', id });
const confirm = session => act(session, 'confirm_goal');
const selection = session => session.coreSession.selection;

test('R07 J01: qualifying a Onepage requires consent and then cites process without changing summary', () => {
  const start = createJourney();
  assert.equal(start.version, JOURNEY_VERSION);
  const proposed = text(start, 'Quero apresentar minha empresa.');
  assert.equal(proposed.reply.intent, 'journey_confirmation_needed');
  assert.deepEqual(selection(proposed.session), []);
  assert.match(getJourneySummary(proposed.session), /Objetivo ainda não selecionado/);
  const chosen = confirm(proposed.session);
  assert.equal(chosen.reply.intent, 'goal_presence');
  assert.deepEqual(selection(chosen.session), ['onepage']);
  assert.ok(chosen.reply.sources.length > 0);
  const process = text(chosen.session, 'Como funciona o projeto?');
  assert.equal(process.reply.intent, 'process');
  assert.ok(process.reply.sources.length > 0);
  assert.deepEqual(selection(process.session), ['onepage']);
  assert.match(getJourneySummary(process.session), /Site Onepage/);
});

test('R07 J02: after choosing Landing Page, mentioning Google Ads is a new unconfirmed proposal', () => {
  const one = confirm(text(createJourney(), 'Preciso captar contatos para uma oferta.').session);
  assert.deepEqual(selection(one.session), ['landing-page']);
  const ads = text(one.session, 'E Google Ads?');
  assert.equal(ads.reply.intent, 'journey_confirmation_needed');
  assert.deepEqual(selection(ads.session), ['landing-page']);
  assert.match(getJourneySummary(ads.session), /Landing Page/);
  const cancelled = act(ads.session, 'cancel_goal');
  assert.equal(cancelled.reply.intent, 'journey_cancelled');
  assert.deepEqual(selection(cancelled.session), ['landing-page']);
});

test('R07 J03: correction only changes a confirmed choice after explicit confirmation', () => {
  const first = confirm(text(createJourney(), 'Quero Onepage.').session);
  const correction = text(first.session, 'Na verdade prefiro Landing Page.');
  assert.equal(correction.reply.intent, 'journey_confirmation_needed');
  assert.deepEqual(selection(correction.session), ['onepage']);
  const switched = confirm(correction.session);
  assert.deepEqual(selection(switched.session), ['landing-page']);
  assert.doesNotMatch(getJourneySummary(switched.session), /Site Onepage/);
  assert.match(getJourneySummary(switched.session), /Landing Page/);
});

test('R07 J04: unsupported email feature never becomes a supported service promise', () => {
  const chosen = confirm(text(createJourney(), 'Quero Onepage.').session);
  const unsupported = text(chosen.session, 'O site inclui e-mail?');
  assert.equal(unsupported.reply.intent, 'grounding_unsupported');
  assert.deepEqual(unsupported.reply.sources, []);
  assert.deepEqual(selection(unsupported.session), ['onepage']);
  assert.doesNotMatch(unsupported.reply.text, /e-mail incluso|e-mail gratuito/i);
});

test('R07 J05: ambiguous objectives do not select a service; explicit clarification proposes one', () => {
  const ambiguous = text(createJourney(), 'Quero um site e uma campanha de anúncios.');
  assert.equal(ambiguous.reply.intent, 'grounding_ambiguous');
  assert.deepEqual(selection(ambiguous.session), []);
  const clarified = text(ambiguous.session, 'Quero primeiro o site.');
  assert.equal(clarified.reply.intent, 'journey_confirmation_needed');
  assert.deepEqual(selection(clarified.session), []);
  assert.deepEqual(selection(confirm(clarified.session).session), ['onepage']);
});

test('R07 J06: pricing and deadlines remain tied to proposal and never promise guarantees', () => {
  const start = createJourney();
  const price = text(start, 'Quanto custa uma Landing Page?');
  assert.equal(price.reply.intent, 'pricing');
  assert.ok(price.reply.sources.length > 0);
  assert.deepEqual(selection(price.session), []);
  assert.match(price.reply.text, /proposta/i);
  const deadline = text(price.session, 'Qual o prazo garantido?');
  assert.deepEqual(selection(deadline.session), []);
  assert.doesNotMatch(deadline.reply.text, /garantimos|entrega em \d+ dias/i);
});

test('R07 J07: private order and sensitive credentials cannot replace a confirmed goal', () => {
  const chosen = confirm(text(createJourney(), 'Quero Onepage.').session);
  const privateReply = text(chosen.session, 'Qual o status do meu pedido?');
  assert.equal(privateReply.reply.intent, 'grounding_boundary');
  assert.deepEqual(selection(privateReply.session), ['onepage']);
  const sensitive = text(privateReply.session, 'Minha senha TEST_SECRET_999');
  assert.equal(sensitive.reply.intent, 'sensitive_input');
  assert.deepEqual(selection(sensitive.session), ['onepage']);
  assert.equal(JSON.stringify(sensitive).includes('TEST_SECRET_999'), false);
});

test('R07 J08: a comparison with real passages is not treated as a purchase choice', () => {
  const compare = text(createJourney(), 'Qual a diferença entre Onepage e Landing Page?');
  assert.equal(compare.reply.intent, 'compare_sites');
  assert.ok(compare.reply.sources.length >= 1);
  assert.deepEqual(selection(compare.session), []);
  assert.match(getJourneySummary(compare.session), /Objetivo ainda não selecionado/);
});

test('R07: channel comparison is informational and does not silently confirm ads', () => {
  const compare = text(createJourney(), 'Google ou Meta Ads: qual canal avaliar?');
  assert.equal(compare.reply.intent, 'channel_compare');
  assert.deepEqual(selection(compare.session), []);
  assert.equal(compare.session.coreSession.goal, null);
});

test('R07: cancel and stale confirmations are safe, and sessions never share selections', () => {
  const first = createJourney();
  assert.equal(act(first, 'confirm_goal').reply.intent, 'journey_no_pending');
  const proposed = text(first, 'Quero Onepage.');
  const cancelled = act(proposed.session, 'cancel_goal');
  assert.equal(act(cancelled.session, 'confirm_goal').reply.intent, 'journey_no_pending');
  const second = createJourney();
  assert.deepEqual(selection(second), []);
  assert.equal(confirm(proposed.session).session.coreSession.goal, 'presence');
  assert.equal(second.coreSession.goal, null);
  const malformed = respondJourney({ ...proposed.session }, { type: 'action', id: 'confirm_goal' });
  assert.equal(malformed.reply.intent, 'journey_invalid');
});

test('R07 J13: an authentic passage from an unrelated topic cannot validate another answer', () => {
  const site = getGroundedAnswer('goal_presence');
  const ads = getGroundedAnswer('channel_google');
  const foreign = {
    text: site.text,
    sources: [{ id: ads.sources[0].id, version: ads.sources[0].version }, ...site.sources.slice(1).map(s => ({ id: s.id, version: s.version }))],
    actions: site.actions.map(({ id }) => ({ id }))
  };
  assert.equal(findGroundedAnswer(foreign), null);
});

test('R07 J14: copying or asking for a human never claims that the summary was sent', () => {
  const chosen = confirm(text(createJourney(), 'Quero Onepage.').session);
  const human = act(chosen.session, 'human');
  assert.equal(human.reply.intent, 'grounding_navigation');
  const summary = act(human.session, 'summary');
  assert.match(summary.reply.text, /não foi enviado à equipe/i);
  assert.match(getJourneySummary(summary.session), /Site Onepage/);
  assert.deepEqual(summary.reply.sources, []);
});

test('R07: malicious getters never execute on special actions', () => {
  const proposed = text(createJourney(), 'Quero Onepage.');
  let reads = 0;
  const attempted = { type: 'action', get id() { reads++; return 'confirm_goal'; } };
  const result = respondJourney(proposed.session, attempted);
  assert.equal(reads, 0);
  assert.equal(result.reply.intent, 'invalid_input');
  assert.deepEqual(selection(result.session), []);
});
