import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const token = 'R111_PRIVATE_DUPLICATE_HEADER_FIXTURE_TOKEN_123456';
const reviewPath = '/__faisca_openai_private/respond';
const pagePath = '/__faisca_openai_private/review';
const caseId = 'compare';
const id = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES[caseId])[0];
const editorial = getGroundedAnswer(id);
assert.ok(editorial, 'fixture must use approved R06 sources');

function approvedDraft() {
  return {
    schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA,
    status: 'draft_answer', answerId: id,
    text: 'Um site Onepage reúne informações em uma página. Uma landing page destaca uma campanha específica.',
    sourceIds: editorial.sources.map(s => s.id),
    modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
    publicReady: false, operationalEffects: false
  };
}

// fetch() cannot express duplicate Host/Authorization. Deliberately send
// HTTP/1.1 raw wire bytes to prove that Node's hidden duplicates are refused.
function raw(server, method, path, entries, body = '') {
  const { port } = new URL(server.address);
  const wire = method + ' ' + path + ' HTTP/1.1\r\n' +
    entries.concat([['Connection', 'close']])
      .map(([key, value]) => key + ': ' + value + '\r\n').join('') +
    '\r\n' + body;
  return new Promise((resolve, reject) => {
    const pieces = [];
    const socket = createConnection(Number(port), '127.0.0.1');
    socket.setTimeout(2500, () => socket.destroy(new Error('Raw HTTP fixture timeout')));
    socket.once('connect', () => socket.write(wire));
    socket.on('data', data => pieces.push(data));
    socket.once('error', reject);
    socket.once('end', () => {
      const message = Buffer.concat(pieces).toString('utf8');
      const match = /^HTTP\/1\.1 (\d{3})/.exec(message);
      match ? resolve(Number(match[1])) : reject(new Error('Missing HTTP response status'));
    });
  });
}

test('R111 ambiguous duplicate raw headers cannot reach the private paid adapter', async t => {
  let dispatched = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: {
      answer: async () => { dispatched++; return approvedDraft(); },
      inspect: () => ({ syntheticOnly: true, externalCalls: 0 })
    },
    reviewToken: token
  });
  t.after(() => server.close());
  const host = '127.0.0.1:' + new URL(server.address).port;
  const body = JSON.stringify({ caseId });
  const base = [
    ['Host', host],
    ['Authorization', 'Bearer ' + token],
    ['Content-Type', 'application/json'],
    ['Content-Length', String(Buffer.byteLength(body))]
  ];
  const adversarial = [
    ['duplicate Host', [['HOST', 'attacker.invalid']]],
    ['duplicate Authorization', [['authorization', 'Bearer attacker_invalid_token']]],
    ['duplicate Origin', [['Origin', 'http://' + host], ['origin', 'http://attacker.invalid']]],
    ['duplicate Content-Type', [['content-type', 'application/json']]],
    ['hidden proxy host', [['X-Forwarded-Host', 'attacker.invalid']]],
    ['hidden proxy proto', [['X-Forwarded-Proto', 'https']]],
    ['forwarded client', [['Forwarded', 'for=192.0.2.5']]],
    ['claimed real IP', [['X-Real-IP', '192.0.2.5']]]
  ];
  for (const [label, added] of adversarial) {
    const status = await raw(server, 'POST', reviewPath, [...base, ...added], body);
    assert.equal(status, 403, label + ' must be rejected before a paid provider dispatch');
  }
  assert.equal(dispatched, 0, 'ambiguous HTTP headers must cost zero model calls');
  assert.equal(server.inspect().requests, 0, 'bad headers are not authorized requests');

  const legitimate = await fetch(server.address + reviewPath, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body
  });
  assert.equal(legitimate.status, 200, 'normal private operator HTTP still works');
  assert.equal((await legitimate.json()).sourceRecipeBound, true);
  assert.equal(dispatched, 1);
});

test('R111 browser review assets reject duplicate Host and forwarded proxy metadata', async t => {
  const server = await startFaiscaOpenAIPrivateReview({
    lab: {
      answer: async () => { throw new Error('GET must never dispatch to AI'); },
      inspect: () => ({ syntheticOnly: true, externalCalls: 0 })
    },
    reviewToken: token
  });
  t.after(() => server.close());
  const host = '127.0.0.1:' + new URL(server.address).port;
  assert.equal(await raw(server, 'GET', pagePath,
    [['Host', host], ['hOsT', 'attacker.invalid']]), 403);
  assert.equal(await raw(server, 'GET', pagePath,
    [['Host', host], ['X-Forwarded-Host', 'attacker.invalid']]), 403);
  const normal = await fetch(server.address + pagePath);
  assert.equal(normal.status, 200);
  assert.match(await normal.text(), /Faísca|Faisca/i);
});
