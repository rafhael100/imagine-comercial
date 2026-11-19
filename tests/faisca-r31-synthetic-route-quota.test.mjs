import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRouteRuntime, createLocalModelRouteProvider } from '../ops/faisca/model-router/runtime.mjs';
import { localModelRouteFixture } from '../ops/faisca/model-router/contract.mjs';
import {
  createSyntheticRouteQuota, isSyntheticRouteQuota, reserveSyntheticRouteInvocation,
  SYNTHETIC_QUOTA_SCHEMA
} from '../ops/faisca/model-router/synthetic-quota.mjs';

const input = (conversationId, messageId, userText='Como funciona o projeto?') =>
  ({ conversationId, messageId, userText });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('R31 rejects untrusted limits and forged objects without executing accessors', () => {
  for (const limits of [
    { maxTotal: 0, maxPerConversation: 1 }, { maxTotal: 2, maxPerConversation: 3 },
    { maxTotal: -1, maxPerConversation: 1 }, { maxTotal: 300, maxPerConversation: 1 },
    { maxTotal: 3, maxPerConversation: 0 }, { maxTotal: 3, maxPerConversation: 65 },
    { maxTotal: 3 }, null
  ]) assert.throws(() => createSyntheticRouteQuota(limits), TypeError);
  let getterCalls = 0;
  const bad = { maxPerConversation: 1 };
  Object.defineProperty(bad, 'maxTotal', { enumerable: true, get() {
    getterCalls++;
    return 2;
  } });
  assert.throws(() => createSyntheticRouteQuota(bad), TypeError);
  assert.equal(getterCalls, 0);
  const forged = Object.freeze({ schema: SYNTHETIC_QUOTA_SCHEMA, inspect() {} });
  assert.equal(isSyntheticRouteQuota(forged), false);
  assert.equal(reserveSyntheticRouteInvocation(forged, 'fake_conversation'), false);
  assert.throws(() => createModelRouteRuntime({
    provider: createLocalModelRouteProvider(), quota: forged
  }), TypeError);
  assert.throws(() => createModelRouteRuntime({
    provider: { kind:'external', route() {} },
    quota: createSyntheticRouteQuota({ maxTotal: 2, maxPerConversation: 1 })
  }), TypeError);
});

test('R31 only real simulated dispatches consume quota, never duplicates or fixed safety replies', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 2, maxPerConversation: 1 });
  let calls = 0;
  const runtime = createModelRouteRuntime({
    provider: { kind: 'simulated', route(request) { calls++; return localModelRouteFixture(request); } },
    quota
  });
  const a = input('r31_conversation_A', 'r31_message_a');
  try {
    const first = await runtime.send(a);
    assert.equal(first.status, 'answered');
    assert.equal(first.delivery, 'simulated');
    const replay = await runtime.send(a);
    assert.deepEqual(replay, first);
    assert.equal(quota.inspect().totalReserved, 1);
    assert.equal(calls, 1);

    const privateTopic = await runtime.send(input('r31_conversation_A', 'r31_private',
      'Qual o andamento do meu pedido?'));
    assert.equal(privateTopic.delivery, 'fixed_boundary');
    assert.equal(quota.inspect().totalReserved, 1);
    const absent = await runtime.send(input('r31_conversation_A', 'r31_absent',
      'Qual é a cor favorita do mascote?'));
    assert.equal(absent.delivery, 'fixed_fallback');
    assert.equal(quota.inspect().totalReserved, 1);

    const blocked = await runtime.send(input('r31_conversation_A','r31_second','Quanto custa?'));
    assert.equal(blocked.status, 'limit');
    assert.equal(blocked.reason, 'synthetic_quota_exhausted');
    assert.equal(blocked.route, null);
    assert.equal(blocked.accepted, false);
    assert.equal(calls, 1);
    const replayDenied = await runtime.send(input('r31_conversation_A','r31_second','Quanto custa?'));
    assert.deepEqual(replayDenied, blocked);
    assert.equal(quota.inspect().rejected, 1, 'Replay must not consume more quota.');

    const b = await runtime.send(input('r31_conversation_B','r31_other','Quanto custa?'));
    assert.equal(b.status, 'answered');
    assert.equal(b.delivery, 'simulated');
    assert.equal(calls, 2);
    const c = await runtime.send(input('r31_conversation_C','r31_limit','Como funciona o projeto?'));
    assert.equal(c.status, 'limit');
    assert.equal(calls, 2);
    assert.deepEqual(quota.inspect(), {
      schema: SYNTHETIC_QUOTA_SCHEMA,
      maxTotal: 2, maxPerConversation: 1,
      totalReserved: 2, rejected: 2, conversations: 2,
      moneySpent: false, externalModelInvocations: 0
    });
    assert.equal(Object.isFrozen(quota.inspect()), true);
    assert.equal(JSON.stringify(quota.inspect()).includes('r31_conversation_A'), false);
    assert.equal(runtime.inspect().externalModelInvocations, 0);
  } finally { runtime.destroy(); }
});

test('R31 preserves spent quota on timeout and forbids blind redispatch', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 1, maxPerConversation: 1 });
  let calls = 0;
  let release;
  const runtime = createModelRouteRuntime({
    provider: { kind:'simulated', route(request) {
      calls++;
      return new Promise(resolve => { release = () => resolve(localModelRouteFixture(request)); });
    } },
    quota, timeoutMs: 10
  });
  const request = input('r31_pending_A','r31_original');
  try {
    const pending = await runtime.send(request);
    assert.equal(pending.status, 'unknown');
    assert.equal(quota.inspect().totalReserved, 1);
    assert.equal((await runtime.send(request)).status, 'unknown');
    assert.equal(calls, 1);
    const outside = await runtime.send(input('r31_pending_B','r31_refused','Quanto custa?'));
    assert.equal(outside.status, 'limit');
    assert.equal(quota.inspect().totalReserved, 1);
    release();
    let reconciled;
    for (let i = 0; i < 15; i++) {
      reconciled = await runtime.reconcile(request);
      if (reconciled.status === 'answered') break;
      await wait(2);
    }
    assert.equal(reconciled.status, 'answered');
    assert.equal(calls, 1);
  } finally { runtime.destroy(); }
  assert.equal(quota.inspect().totalReserved, 1,
    'A timed-out request must not be refunded without external reconciliation.');
});

test('R31 shares admission between runtimes but never reports a real model or monetary expense', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 1, maxPerConversation: 1 });
  let calls = 0;
  const mk = () => createModelRouteRuntime({
    provider: { kind:'simulated', route(request) {
      calls++;
      return localModelRouteFixture(request);
    } }, quota
  });
  const first = mk(), second = mk();
  try {
    assert.equal((await first.send(input('r31_isolate_A','r31_msg_a'))).status,'answered');
    assert.equal((await second.send(input('r31_isolate_B','r31_msg_b'))).status,'limit');
    assert.equal(calls,1);
    assert.equal(quota.inspect().externalModelInvocations,0);
    assert.equal(quota.inspect().moneySpent,false);
  } finally {first.destroy();second.destroy();}
});

test('R31 sensitive input is refused without consuming a route quota', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 1, maxPerConversation: 1 });
  const runtime = createModelRouteRuntime({ provider: createLocalModelRouteProvider(), quota });
  try {
    const sensitive = await runtime.send(input('r31_private_01','r31_private_msg',
      'Minha senha é EXAMPLE_SECRET_123456 e preciso de ajuda.'));
    assert.equal(sensitive.status,'invalid_request');
    assert.equal(quota.inspect().totalReserved,0);
    assert.equal((await runtime.send(input('r31_private_01','r31_valid'))).status,'answered');
    assert.equal(quota.inspect().totalReserved,1);
  } finally {runtime.destroy();}
});
