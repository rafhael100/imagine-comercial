import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourney, respondJourney } from '../ops/faisca/journey/state.mjs';

const type = (session, text) => respondJourney(session, { type: 'text', text });
const action = (session, id) => respondJourney(session, { type: 'action', id });
const MASK = '[Mensagem livre não registrada]';

test('R71 standalone R07 discards unclassified typed bytes before UI echo', () => {
  const marker = 'R71_SYNTHETIC_PRIVATE_UNKNOWN_001';
  const result = type(createJourney(), marker);
  assert.equal(result.userText, MASK);
  assert.ok(!JSON.stringify(result).includes(marker));
  assert.equal(result.session.pendingGoal, null);
  assert.equal(result.reply.intent, 'grounding_unsupported');
});

test('R71 standalone R07 retains grounded intent and explicit confirmation with masked text', () => {
  const marker = 'R71_SYNTHETIC_PRIVATE_GOAL_002';
  const proposal = type(createJourney(), 'Quero Site Onepage. ' + marker);
  assert.equal(proposal.userText, MASK);
  assert.equal(proposal.reply.intent, 'journey_confirmation_needed');
  assert.ok(!JSON.stringify(proposal).includes(marker));
  assert.equal(proposal.session.pendingGoal, 'goal_presence');
  const confirmed = action(proposal.session, 'confirm_goal');
  assert.equal(confirmed.reply.intent, 'goal_presence');
  assert.equal(confirmed.userText, 'Apresentar minha empresa');
  assert.deepEqual(confirmed.session.coreSession.selection, ['onepage']);
  assert.ok(!JSON.stringify(confirmed).includes(marker));
});

test('R71 standalone R07 retains reviewed PHP-independent grounded FAQ without raw transcript', () => {
  const marker = 'R71_SYNTHETIC_PRIVATE_PRICING_003';
  const result = type(createJourney(), 'Quanto custa Onepage? ' + marker);
  assert.equal(result.userText, MASK);
  assert.equal(result.reply.intent, 'pricing');
  assert.ok(result.reply.sources.length > 0);
  assert.ok(!JSON.stringify(result).includes(marker));
  assert.ok(!JSON.stringify(result).includes('checkoutUrl'));
});

test('R71 malicious accessors are never invoked by typed-echo detection', () => {
  const initial = createJourney();
  let reads = 0;
  const malicious = Object.defineProperty({}, 'type', {
    enumerable: true, get() { reads++; return 'text'; }
  });
  const result = respondJourney(initial, malicious);
  assert.equal(reads, 0);
  assert.equal(result.reply.intent, 'invalid_input');
  assert.equal(result.userText, '[Mensagem não utilizada]');
});
