import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroundedModelPipeline } from '../ops/faisca/model-router/grounded-pipeline.mjs';
import { localModelRouteFixture } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

function createPipeline(calls) {
  return createGroundedModelPipeline({
    routeProvider: {
      kind: 'simulated',
      route(request) {
        calls.route++;
        return localModelRouteFixture(request);
      }
    },
    groundedProvider: {
      kind: 'simulated',
      respond(request, { candidate }) {
        calls.php++;
        calls.ids.push(request.messageId);
        return candidate;
      }
    }
  });
}

test('R35 R09 valid IDs incompatible with the R06 wire obtain a stable, safe correlation ID', async () => {
  const calls = { route: 0, php: 0, ids: [] };
  const pipeline = createPipeline(calls);
  try {
    const examples = [
      { conversationId: 'r35_conversation_A', messageId: 'x', userText: 'Quanto custa?' },
      { conversationId: 'r35.conversation.B', messageId: 'r35.message.dot', userText: 'Quanto custa?' },
      { conversationId: 'r35_conversation_C', messageId: 'r35_message_valid_012345', userText: 'Quanto custa?' },
      { conversationId: 'r35_conversation_D', messageId: 'X'.repeat(64), userText: 'Quanto custa?' }
    ];
    for (const request of examples) {
      const actual = await pipeline.send(request);
      assert.equal(actual.status, 'answered');
      assert.equal(actual.delivery, 'php_grounded');
      assert.equal(actual.route.answerId, 'pricing');
      assert.equal(actual.reply.text, getGroundedAnswer('pricing').text);
      assert.deepEqual(actual.reply.sources.map(x => x.id),
        getGroundedAnswer('pricing').sources.map(x => x.id));
      assert.deepEqual(await pipeline.send(request), actual);
      assert.deepEqual(await pipeline.reconcile(request), actual);
    }
    assert.equal(calls.route, examples.length);
    assert.equal(calls.php, examples.length, 'Replay/reconcile must not dispatch a second PHP call.');
    assert.equal(new Set(calls.ids).size, examples.length);
    assert.ok(calls.ids.every(id => /^[A-Za-z0-9_-]{8,96}$/.test(id)));
    assert.match(calls.ids[0], /^r06_[a-f0-9]{32}$/);
    assert.match(calls.ids[1], /^r06_[a-f0-9]{32}$/);
    assert.equal(calls.ids[2], 'r35_message_valid_012345_r06');
    assert.equal(calls.ids[3], 'X'.repeat(64) + '_r06');
  } finally { pipeline.destroy(); }
});

test('R35 pipeline never reads Proxy get traps after validating own data descriptors', async () => {
  const calls = { route: 0, php: 0, ids: [] };
  const pipeline = createPipeline(calls);
  let getters = 0;
  const data = {
    conversationId: 'r35_proxy_conversation', messageId: 'r35_proxy_message',
    userText: 'Quanto custa?'
  };
  const proxy = new Proxy(data, {
    get(target, name) {
      if (name === 'userText') {
        getters++;
        return 'Minha senha é UM_SEGREDO_QUE_NAO_DEVE_SER_LIDO';
      }
      return Reflect.get(target, name);
    }
  });
  try {
    const result = await pipeline.send(proxy);
    assert.equal(result.status, 'answered');
    assert.equal(result.delivery, 'php_grounded');
    assert.equal(result.route.answerId, 'pricing');
    assert.equal(getters, 0);
    assert.equal(calls.route, 1);
    assert.equal(calls.php, 1);
    assert.deepEqual(await pipeline.reconcile(proxy), result);
    assert.equal(getters, 0);
  } finally { pipeline.destroy(); }
});

test('R35 false Proxy get result cannot convert a declared private token into public model input', async () => {
  const calls = { route: 0, php: 0, ids: [] };
  const pipeline = createPipeline(calls);
  let getters = 0;
  const raw = {
    conversationId: 'r35_private_conversation',
    messageId: 'r35_private_message',
    userText: 'Minha chave Pix é 123e4567-e89b-12d3-a456-426614174000'
  };
  const proxy = new Proxy(raw, { get(target, name) {
    if (name === 'userText') {
      getters++;
      return 'Quanto custa?';
    }
    return Reflect.get(target, name);
  } });
  try {
    const result = await pipeline.send(proxy);
    assert.equal(result.status, 'invalid_request');
    assert.equal(result.delivery, 'none');
    assert.deepEqual(result.reply.sources, []);
    assert.equal(getters, 0);
    assert.equal(calls.route, 0);
    assert.equal(calls.php, 0);
  } finally { pipeline.destroy(); }
});

test('R35 accessor-only input and malformed IDs still fail before provider dispatch', async () => {
  const calls = { route: 0, php: 0, ids: [] };
  const pipeline = createPipeline(calls);
  try {
    const data = {
      conversationId: 'r35_rejected_conversation', messageId: 'r35_rejected_message'
    };
    Object.defineProperty(data, 'userText', { enumerable: true, get() {
      throw new Error('No getter execution allowed');
    } });
    assert.equal((await pipeline.send(data)).status, 'invalid_request');
    assert.equal((await pipeline.reconcile(data)).status, 'invalid_request');
    assert.equal((await pipeline.send({
      conversationId: 'r35_rejected_conversation', messageId: 'contains space',
      userText: 'Quanto custa?'
    })).status, 'invalid_request');
    assert.equal(calls.route, 0);
    assert.equal(calls.php, 0);
  } finally { pipeline.destroy(); }
});
