import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupportJourney, respondSupportJourney } from '../ops/faisca/support/journey.mjs';

const act = (session, id) => respondSupportJourney(session, { type: 'action', id });
const text = (session, value) => respondSupportJourney(session, { type: 'text', text: value });

test('R64: anonymous support accepts only bounded typed input and never echoes its bytes', () => {
  const initial = act(createSupportJourney(), 'r10:topic:billing').session;
  assert.equal(initial.triage.topic, 'billing');

  for (const length of [0, 1, 800]) {
    const marker = 'PRIVATE_R64_MARKER_';
    const raw = marker + 'X'.repeat(Math.max(0, length - marker.length));
    const payload = length === 0 ? '' : raw.slice(0, length);
    const result = text(initial, payload);
    assert.equal(result.userText, '[Mensagem livre não registrada]');
    assert.match(result.reply.text, /aceita apenas as opções disponíveis/);
    assert.equal(result.session.triage, initial.triage);
    assert.equal(result.session.triage.topic, 'billing');
    assert.equal(result.session.triage.service, null);
    assert.ok(!JSON.stringify(result).includes(marker));
  }
});

test('R64: overlong support text fails closed without copying it to transcript or changing state', () => {
  const initial = act(createSupportJourney(), 'r10:topic:delivery').session;
  const marker = 'R64_SUPERLONG_PRIVATE_MARKER';
  for (const length of [801, 8192, 65536]) {
    const result = text(initial, marker + 'Z'.repeat(length - marker.length));
    assert.equal(result.userText, '');
    assert.match(result.reply.text, /Não consegui validar a opção/);
    assert.equal(result.session.triage, initial.triage);
    assert.equal(result.session.triage.topic, 'delivery');
    assert.equal(result.session.triage.service, null);
    assert.equal(result.session.triage.detail, null);
    assert.deepEqual(result.reply.sources, []);
    assert.ok(!JSON.stringify(result).includes(marker));
  }
});

test('R64: anomalous support objects and accessors cannot bypass the local text boundary', () => {
  const initial = createSupportJourney();
  let getterCount = 0;
  for (const payload of [
    { type: 'text', text: 'hello', data: 'unexpected' },
    { type: 'text', text: ['not-a-string'] },
    { type: 'text', text: null },
    Object.defineProperty({ type: 'text' }, 'text', { enumerable: true, get() { getterCount++; throw new Error('do not invoke'); } }),
    Object.assign(Object.create(null), { type: 'text', text: 'x'.repeat(801) })
  ]) {
    const result = respondSupportJourney(initial, payload);
    assert.equal(result.userText, '');
    assert.match(result.reply.text, /Não consegui validar a opção/);
    assert.equal(result.session.triage.topic, null);
    assert.equal(result.session.triage.service, null);
    assert.equal(result.session.triage.detail, null);
  }
  assert.equal(getterCount, 0);
});
