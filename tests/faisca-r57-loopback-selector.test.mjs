import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  prepareModelRouteRequest, retrieveCandidateAnswerIds,
  ROUTER_RESPONSE_SCHEMA
} from '../ops/faisca/model-router/contract.mjs';
import { CANDIDATE_DECISION_SCHEMA } from '../ops/faisca/model-router/decision-bridge.mjs';
import { createCandidateOnlyLoopbackRouteProvider } from '../ops/faisca/model-router/loopback-selector.mjs';
import { createModelRouteRuntime } from '../ops/faisca/model-router/runtime.mjs';

const message = 'Quanto custa?';
const makeInput = (id = 'message_r57_01') => ({
  conversationId: 'conversation_r57_private_01',
  messageId: id,
  userText: message
});
function makeRequest() {
  return prepareModelRouteRequest({
    ...makeInput(),
    candidateAnswerIds: retrieveCandidateAnswerIds(message),
    allowedClarificationIds: ['support_unknown']
  });
}
async function fixture(handler) {
  const requests = [];
  const server = createServer(async(req, res) => {
    const chunks = [];
    for await(const chunk of req) chunks.push(chunk);
    const content = Buffer.concat(chunks).toString('utf8');
    requests.push({ method: req.method, url: req.url, headers: req.headers, content });
    await handler(req, res, content);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    endpoint: 'http://127.0.0.1:' + server.address().port + '/candidate-only',
    requests,
    close: () => new Promise(resolve => server.close(resolve))
  };
}
function goodDecision(body) {
  const parsed = JSON.parse(body);
  return JSON.stringify({
    schema: CANDIDATE_DECISION_SCHEMA,
    mode: 'answer',
    answerId: parsed.rankedAnswerIds[0],
    clarificationId: null
  });
}

test('R57 rejects external destinations, credentials, redirects and ambiguous local URLs', () => {
  for (const endpoint of [
    'https://127.0.0.1:443/candidate-only', 'http://localhost:8080/candidate-only',
    'http://127.0.0.2:8080/candidate-only', 'http://169.254.169.254:80/candidate-only',
    'http://127.0.0.1:8080/candidate-only?token=secret',
    'http://user:pass@127.0.0.1:8080/candidate-only',
    'http://127.0.0.1:8080/candidate-only#anchor', 'http://127.0.0.1:0/candidate-only',
    'http://127.0.0.1:65536/candidate-only', 'http://127.0.0.1:8080/other'
  ]) assert.throws(() => createCandidateOnlyLoopbackRouteProvider({ endpoint }), TypeError, endpoint);
  assert.throws(() => createCandidateOnlyLoopbackRouteProvider({ endpoint: 'http://127.0.0.1:8080/candidate-only', timeoutMs: 0 }), TypeError);
  let reads = 0;
  const malicious = { get endpoint() { reads++; throw new Error('getter executed'); } };
  assert.throws(() => createCandidateOnlyLoopbackRouteProvider(malicious), TypeError);
  assert.equal(reads, 0);
});

test('R57 real loopback HTTP transfers only editorial IDs and accepts host-verified selections', async t => {
  const local = await fixture((req, res, body) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(goodDecision(body));
  });
  t.after(local.close);
  const provider = createCandidateOnlyLoopbackRouteProvider({ endpoint: local.endpoint });
  const request = makeRequest();
  assert.ok(request);
  const result = await provider.route(request);
  assert.equal(result.schema, ROUTER_RESPONSE_SCHEMA);
  assert.equal(result.invocationId, request.invocationId);
  assert.equal(result.messageId, request.messageId);
  assert.equal(result.routeStatus, 'grounded');
  assert.equal(result.answerId, 'pricing');
  assert.equal(result.clarificationId, null);
  assert.equal(local.requests.length, 1);
  const outbound = local.requests[0];
  assert.equal(outbound.method, 'POST');
  assert.equal(outbound.url, '/candidate-only');
  assert.match(outbound.headers['content-type'], /application\/json/);
  const data = JSON.parse(outbound.content);
  assert.deepEqual(Object.keys(data), [
    'schema', 'task', 'locale', 'catalogVersion', 'rankedAnswerIds',
    'allowedClarificationIds', 'maxSelectedIds', 'maxOutputChars'
  ]);
  for(const privateValue of [message, request.messageId, request.conversationId, request.invocationId,
    'email', 'phone', 'buyer', 'payment', 'userText', 'crm.write']) {
    assert.ok(!outbound.content.includes(privateValue), privateValue);
  }
});

test('R57 route runtime deduplicates and never resends the same message to loopback fixture', async t => {
  const local = await fixture((req, res, body) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(goodDecision(body));
  });
  t.after(local.close);
  const runtime = createModelRouteRuntime({
    provider: createCandidateOnlyLoopbackRouteProvider({ endpoint: local.endpoint }),
    timeoutMs: 2000
  });
  t.after(() => runtime.destroy());
  const first = await runtime.send(makeInput('message_r57_dedup_01'));
  assert.equal(first.status, 'answered');
  assert.equal(first.delivery, 'simulated');
  assert.equal(first.route.answerId, 'pricing');
  const repeated = await runtime.send(makeInput('message_r57_dedup_01'));
  assert.equal(repeated, first);
  assert.equal((await runtime.reconcile(makeInput('message_r57_dedup_01'))).route.answerId, 'pricing');
  assert.equal(local.requests.length, 1);
  assert.equal(runtime.inspect().externalModelInvocations, 0);
});

test('R57 malformed, oversized and redirected HTTP responses fail closed without echoing details', async t => {
  let mode = 'forged';
  const local = await fixture((req, res, body) => {
    if(mode === 'redirect') {
      res.writeHead(302, { location: 'https://example.invalid/external' }); res.end(); return;
    }
    if(mode === 'bad_type') {
      res.writeHead(200, { 'content-type': 'text/plain' }); res.end(goodDecision(body)); return;
    }
    if(mode === 'oversized') {
      res.writeHead(200, { 'content-type': 'application/json' }); res.end('X'.repeat(300)); return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ schema: CANDIDATE_DECISION_SCHEMA,
      mode: 'answer', answerId: mode === 'forged' ? 'crm.write' : 'pricing',
      clarificationId: null, ...(mode === 'extra' ? { tool: 'crm.write' } : {}) }));
  });
  t.after(local.close);
  const provider = createCandidateOnlyLoopbackRouteProvider({ endpoint: local.endpoint });
  for (const next of ['forged', 'extra', 'oversized', 'redirect', 'bad_type']) {
    mode = next;
    await assert.rejects(provider.route(makeRequest()), error =>
      error instanceof Error && error.message === 'R57: local candidate selector unavailable or unverified.', next);
  }
  assert.equal(local.requests.length, 5);
});

test('R57 deadline refuses a hanging loopback fixture without retrying', async t => {
  const local = await fixture(async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    if (!res.destroyed) {
      res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
    }
  });
  t.after(local.close);
  const provider = createCandidateOnlyLoopbackRouteProvider({ endpoint: local.endpoint, timeoutMs: 50 });
  await assert.rejects(provider.route(makeRequest()), /local candidate selector unavailable or unverified/);
  assert.equal(local.requests.length, 1);
});

test('R57 forged host request never reaches even the local fixture', async t => {
  const local = await fixture((req,res,body) => {
    res.writeHead(200, {'content-type':'application/json'}); res.end(goodDecision(body));
  });
  t.after(local.close);
  const provider = createCandidateOnlyLoopbackRouteProvider({ endpoint: local.endpoint });
  const genuine = makeRequest();
  await assert.rejects(provider.route({ ...genuine }), /trusted candidate envelope required/);
  assert.equal(local.requests.length, 0);
});
