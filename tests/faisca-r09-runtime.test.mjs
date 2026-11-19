import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createModelRouteRuntime, createLocalModelRouteProvider
} from '../ops/faisca/model-router/runtime.mjs';
import { localModelRouteFixture } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const input = (messageId, userText = 'Como funciona o projeto?', conversationId = 'r09_runtime_conversation_01') =>
  ({ conversationId, messageId, userText });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('R09 runtime accepts only bounded simulated providers', () => {
  assert.throws(() => createModelRouteRuntime({ provider: { kind: 'external', route() {} } }), TypeError);
  assert.throws(() => createModelRouteRuntime({ provider: createLocalModelRouteProvider(), timeoutMs: 0 }), TypeError);
  assert.throws(() => createLocalModelRouteProvider({ delayMs: 3000 }), TypeError);
});

test('R09 runtime returns exact approved editorial text and sources', async () => {
  const runtime = createModelRouteRuntime({ provider: createLocalModelRouteProvider() });
  try {
    const answer = await runtime.send(input('r09_runtime_answer_01'));
    assert.equal(answer.status, 'answered');
    assert.equal(answer.delivery, 'simulated');
    assert.equal(answer.accepted, true);
    assert.equal(answer.route.answerId, 'process');
    assert.equal(answer.route.text, getGroundedAnswer('process').text);
    assert.deepEqual(answer.route.sources, getGroundedAnswer('process').sources);
    assert.equal(answer.externalModelInvocations, 0);
    assert.equal(answer.operationalEffects, false);
    assert.deepEqual(runtime.inspect(), {
      live: true, entries: 1, conversations: 1, dispatched: 1,
      completed: 1, failed: 0, pending: 0, externalModelInvocations: 0
    });
  } finally { runtime.destroy(); }
});

test('R09 no-candidate and sensitive messages never dispatch to the provider', async () => {
  let calls = 0;
  const provider = { kind: 'simulated', route(request) { calls++; return localModelRouteFixture(request); } };
  const runtime = createModelRouteRuntime({ provider });
  try {
    const unsupported = await runtime.send(input('r09_runtime_unknown_01', 'Qual é a cor favorita do mascote?'));
    assert.equal(unsupported.status, 'answered');
    assert.equal(unsupported.delivery, 'fixed_fallback');
    assert.equal(unsupported.route.routeStatus, 'unsupported');
    assert.equal(calls, 0);

    const privateMessage = await runtime.send(input('r09_runtime_private_01',
      'Meu telefone é +55 85 99999-9999 e quero uma Landing Page.'));
    assert.equal(privateMessage.status, 'invalid_request');
    assert.equal(calls, 0);
    assert.equal(runtime.inspect().dispatched, 0);
  } finally { runtime.destroy(); }
});

test('R09 message replay is idempotent and conflicting reuse is refused', async () => {
  let calls = 0;
  const provider = { kind: 'simulated', async route(request) { calls++; await wait(15); return localModelRouteFixture(request); } };
  const runtime = createModelRouteRuntime({ provider });
  try {
    const same = input('r09_runtime_replay_01');
    const [first, replay] = await Promise.all([runtime.send(same), runtime.send(same)]);
    assert.deepEqual(first, replay);
    assert.equal(calls, 1);
    const conflict = await runtime.send(input('r09_runtime_replay_01', 'Quanto custa?'));
    assert.equal(conflict.status, 'conflict');
    assert.equal(calls, 1);
  } finally { runtime.destroy(); }
});

test('R09 permits only one unresolved route per conversation', async () => {
  let release;
  let captured;
  let calls = 0;
  const provider = { kind: 'simulated', route(request) {
    calls++; captured = request;
    return new Promise(resolve => { release = () => resolve(localModelRouteFixture(request)); });
  } };
  const runtime = createModelRouteRuntime({ provider, timeoutMs: 500 });
  try {
    const firstPromise = runtime.send(input('r09_runtime_busy_01'));
    await wait(0);
    const busy = await runtime.send(input('r09_runtime_busy_02', 'Quanto custa?'));
    assert.equal(busy.status, 'busy');
    assert.equal(calls, 1);
    release();
    const first = await firstPromise;
    assert.equal(first.status, 'answered');
    assert.equal(first.route.answerId, 'process');
    assert.ok(captured);
  } finally { runtime.destroy(); }
});

test('R09 timeout does not redispatch and late result is available only by reconciliation', async () => {
  let release;
  let calls = 0;
  const provider = { kind: 'simulated', route(request) {
    calls++;
    return new Promise(resolve => { release = () => resolve(localModelRouteFixture(request)); });
  } };
  const runtime = createModelRouteRuntime({ provider, timeoutMs: 10 });
  const request = input('r09_runtime_timeout_01');
  try {
    const initial = await runtime.send(request);
    assert.equal(initial.status, 'unknown');
    assert.equal(initial.delivery, 'unknown');
    assert.equal(runtime.inspect().pending, 1);
    const replay = await runtime.send(request);
    assert.deepEqual(replay, initial);
    assert.equal(calls, 1);
    assert.equal((await runtime.send(input('r09_runtime_timeout_02', 'Quanto custa?'))).status, 'busy');
    release();
    let reconciled;
    for (let i = 0; i < 20; i++) {
      reconciled = await runtime.reconcile(request);
      if (reconciled.status !== 'unknown') break;
      await wait(2);
    }
    assert.equal(reconciled.status, 'answered');
    assert.equal(reconciled.route.answerId, 'process');
    assert.equal(calls, 1);
    assert.equal(runtime.inspect().pending, 0);
    // A replay returns the original uncertainty; reconciliation is explicit.
    assert.equal((await runtime.send(request)).status, 'unknown');
  } finally { runtime.destroy(); }
});

test('R09 provider failure and invalid output fall back without unverified sources', async () => {
  for (const scenario of ['unavailable', 'wrong_topic', 'invented_text', 'tool_request']) {
    const runtime = createModelRouteRuntime({ provider: createLocalModelRouteProvider({ scenario }) });
    try {
      const outcome = await runtime.send(input('r09_runtime_failure_' + scenario));
      assert.equal(outcome.accepted, true);
      assert.equal(outcome.delivery, 'fixed_fallback');
      assert.equal(outcome.route.routeStatus, 'unsupported');
      assert.deepEqual(outcome.route.sources, []);
    } finally { runtime.destroy(); }
  }
});

test('R09 reset destroys unresolved work and discards late provider output', async () => {
  let release;
  let calls = 0;
  const provider = { kind: 'simulated', route(request) {
    calls++;
    return new Promise(resolve => { release = () => resolve(localModelRouteFixture(request)); });
  } };
  const runtime = createModelRouteRuntime({ provider, timeoutMs: 500 });
  const request = input('r09_runtime_reset_01');
  const pending = runtime.send(request);
  await wait(0);
  runtime.destroy();
  const closed = await pending;
  assert.equal(closed.status, 'closed');
  release();
  await wait(0);
  assert.equal((await runtime.reconcile(request)).status, 'closed');
  assert.equal(runtime.inspect().pending, 0);
  assert.equal(calls, 1);
});

test('R09 same message IDs remain isolated across independent conversations', async () => {
  let calls = 0;
  const runtime = createModelRouteRuntime({ provider: {
    kind: 'simulated', async route(request) { calls++; return localModelRouteFixture(request); }
  } });
  try {
    const [one, two] = await Promise.all([
      runtime.send(input('r09_shared_message_01', 'Quero apresentar minha empresa.', 'r09_conversation_A')),
      runtime.send(input('r09_shared_message_01', 'Quanto custa?', 'r09_conversation_B'))
    ]);
    assert.equal(one.status, 'answered');
    assert.equal(two.status, 'answered');
    assert.equal(one.route.answerId, 'goal_presence');
    assert.equal(two.route.answerId, 'pricing');
    assert.equal(calls, 2);
  } finally { runtime.destroy(); }
});
