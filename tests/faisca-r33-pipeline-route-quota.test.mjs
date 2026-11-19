import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroundedModelPipeline } from '../ops/faisca/model-router/grounded-pipeline.mjs';
import { createSyntheticRouteQuota } from '../ops/faisca/model-router/synthetic-quota.mjs';
import { localModelRouteFixture } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const input = (conversationId, messageId, userText = 'Quanto custa?') =>
  ({ conversationId, messageId, userText });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function providers(calls) {
  return {
    routeProvider: {
      kind: 'simulated', route(request) {
        calls.route++;
        return localModelRouteFixture(request);
      }
    },
    groundedProvider: {
      kind: 'simulated', respond(_request, { candidate }) {
        calls.php++;
        return candidate;
      }
    }
  };
}

test('R33 one quota reservation gates both R09 selection and the R06 grounded bridge', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 1, maxPerConversation: 1 });
  const calls = { route: 0, php: 0 };
  const pipeline = createGroundedModelPipeline({ ...providers(calls), routeQuota: quota });
  try {
    const first = input('r33_conversation_A', 'r33_first');
    const accepted = await pipeline.send(first);
    assert.equal(accepted.status, 'answered');
    assert.equal(accepted.delivery, 'php_grounded');
    assert.equal(accepted.route.answerId, 'pricing');
    assert.equal(accepted.reply.text, getGroundedAnswer('pricing').text);
    assert.deepEqual(accepted.reply.sources, getGroundedAnswer('pricing').sources);
    assert.equal(calls.route, 1);
    assert.equal(calls.php, 1);
    assert.equal(quota.inspect().totalReserved, 1);

    const replay = await pipeline.send(first);
    assert.deepEqual(replay, accepted);
    assert.equal(calls.php, 1);

    const second = input('r33_conversation_A','r33_second','Como funciona o projeto?');
    const denied = await pipeline.send(second);
    assert.equal(denied.status, 'limit');
    assert.equal(denied.reason, 'synthetic_quota_exhausted');
    assert.equal(denied.accepted, false);
    assert.deepEqual(denied.reply.sources, []);
    assert.equal(calls.route, 1);
    assert.equal(calls.php, 1);
    assert.deepEqual(await pipeline.reconcile(second), denied);
    assert.deepEqual(await pipeline.send(second), denied);
    assert.equal(quota.inspect().rejected, 1);

    const outside = await pipeline.send(input('r33_conversation_B','r33_other','Quanto custa?'));
    assert.equal(outside.status, 'limit');
    assert.equal(calls.route, 1);
    assert.equal(calls.php, 1);

    const privacy = await pipeline.send(input('r33_conversation_A','r33_private',
      'Qual o andamento do meu pedido?'));
    assert.equal(privacy.status, 'answered');
    assert.equal(privacy.delivery, 'fixed_boundary');
    assert.equal(privacy.route.routeStatus, 'authentication_required');
    assert.equal(calls.php, 1);
    assert.equal(quota.inspect().totalReserved, 1);
    assert.equal(pipeline.inspect().externalModelInvocations, 0);
    assert.equal(pipeline.inspect().operationalEffects, false);
  } finally {pipeline.destroy();}
});

test('R33 fixed unsupported text and sensitive data never touch either provider or quota', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 1, maxPerConversation: 1 });
  const calls = { route: 0, php: 0 };
  const pipeline = createGroundedModelPipeline({ ...providers(calls), routeQuota: quota });
  try {
    const unsupported = await pipeline.send(input('r33_safety','r33_unknown',
      'Qual é a cor favorita do mascote?'));
    assert.equal(unsupported.status,'answered');
    assert.equal(unsupported.delivery,'fixed_fallback');
    const sensitive = await pipeline.send(input('r33_safety','r33_secret',
      'Minha chave Pix é 123e4567-e89b-12d3-a456-426614174000'));
    assert.equal(sensitive.status,'invalid_request');
    assert.equal(quota.inspect().totalReserved,0);
    assert.equal(calls.route,0);
    assert.equal(calls.php,0);
  } finally {pipeline.destroy();}
});

test('R33 quota reservation is conservative across timeout and manual reconciliation', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 1, maxPerConversation: 1 });
  let release;
  const calls = { route: 0, php: 0 };
  const pipeline = createGroundedModelPipeline({
    routeProvider: { kind:'simulated', route(request) {
      calls.route++;
      return new Promise(resolve => { release = () => resolve(localModelRouteFixture(request)); });
    } },
    groundedProvider: {
      kind:'simulated', respond(_request, { candidate }) { calls.php++; return candidate; }
    },
    routeQuota: quota, routeTimeoutMs: 10
  });
  const first = input('r33_timeout_session','r33_timeout_first','Quanto custa?');
  try {
    const pending = await pipeline.send(first);
    assert.equal(pending.status,'unknown');
    assert.equal(quota.inspect().totalReserved,1);
    assert.equal(calls.route,1);
    assert.equal(calls.php,0);
    const blocked = await pipeline.send(input('r33_other','r33_block','Quanto custa?'));
    assert.equal(blocked.status,'limit');
    assert.equal(calls.route,1);
    release();
    let done;
    for (let i = 0; i < 25; i++) {
      done = await pipeline.reconcile(first);
      if (done.status === 'answered') break;
      await sleep(2);
    }
    assert.equal(done.status,'answered');
    assert.equal(done.delivery,'php_grounded');
    assert.equal(calls.php,1);
  } finally {pipeline.destroy();}
  assert.equal(quota.inspect().totalReserved,1);
});

test('R33 concurrent pipelines cannot bypass a shared route quota', async () => {
  const quota = createSyntheticRouteQuota({ maxTotal: 1, maxPerConversation: 1 });
  const counters = { route: 0, php: 0 };
  const a = createGroundedModelPipeline({ ...providers(counters), routeQuota: quota });
  const b = createGroundedModelPipeline({ ...providers(counters), routeQuota: quota });
  try {
    const [first, second] = await Promise.all([
      a.send(input('r33_s1','r33_m1','Como funciona o projeto?')),
      b.send(input('r33_s2','r33_m2','Quanto custa?'))
    ]);
    assert.equal(first.status,'answered');
    assert.equal(second.status,'limit');
    assert.equal(counters.route,1);
    assert.equal(counters.php,1);
    assert.equal(quota.inspect().totalReserved,1);
  } finally {a.destroy();b.destroy();}
});

test('R33 refuses forged quotas or external providers before pipeline startup', () => {
  assert.throws(() => createGroundedModelPipeline({
    ...providers({ route: 0, php: 0 }), routeQuota: { schema:'faisca.synthetic-route-quota.v1' }
  }), TypeError);
  const quota = createSyntheticRouteQuota({ maxTotal: 2, maxPerConversation: 1 });
  assert.throws(() => createGroundedModelPipeline({
    routeProvider: { kind:'external', route() {} },
    groundedProvider: { kind:'simulated', respond() {} },
    routeQuota: quota
  }), TypeError);
});
