import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  PRIVATE_REVIEW_PAGE_PATH,
  PRIVATE_REVIEW_SCRIPT_PATH,
  PRIVATE_REVIEW_STYLE_PATH
} from '../ops/faisca/openai/private-review-page.mjs';

const bearer = 'R79_PRIVATE_UI_BROWSER_TOKEN_SYNTHETIC_2026';
function makeLab() {
  let invoked = 0;
  return {
    answer: async () => {
      invoked++;
      return {
        status: 'draft_answer',
        text: 'O site Onepage apresenta uma empresa em uma página, enquanto a Landing Page se concentra em uma campanha específica.',
        sourceIds: ['faisca.passage.onepage.description@r06-1'],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ calls: invoked, durableBillingLimit: false }),
    count: () => invoked
  };
}

async function withReview(t) {
  const lab = makeLab();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: bearer, port: 0 });
  t.after(() => server.close());
  return { lab, server };
}

async function rawGet(server, path, host) {
  const url = new URL(server.address);
  return await new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1',
      port: Number(url.port),
      path,
      method: 'GET',
      headers: { Host: host }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.once('end', () => resolve({
        status: res.statusCode, body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    request.once('error', reject);
    request.end();
  });
}

test('R79 private page, script and CSS serve only static content on loopback without API credentials', async t => {
  const { lab, server } = await withReview(t);
  for (const [path, mime] of [
    [PRIVATE_REVIEW_PAGE_PATH, 'text/html'],
    [PRIVATE_REVIEW_SCRIPT_PATH, 'text/javascript'],
    [PRIVATE_REVIEW_STYLE_PATH, 'text/css']
  ]) {
    const response = await fetch(server.address + path, { redirect: 'error' });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') ?? '', new RegExp('^' + mime));
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    const body = await response.text();
    assert.doesNotMatch(body, /sk-proj-|sk-test-|localStorage|sessionStorage|indexedDB/i, path);
  }
  const html = await (await fetch(server.address + PRIVATE_REVIEW_PAGE_PATH)).text();
  assert.match(html, /type="password"/);
  assert.match(html, /<select id="review-case"/);
  assert.match(html, /Pergunta fictícia/);
  assert.match(html, /não é a chave da OpenAI/i);
  assert.doesNotMatch(html, /<textarea|name="userText"|type="file"/i);
  const script = await (await fetch(server.address + PRIVATE_REVIEW_SCRIPT_PATH)).text();
  assert.match(script, /Authorization/);
  assert.match(script, /textContent/);
  assert.match(script, /credentials:\s*'omit'/);
  assert.match(script, /validCases/);
  assert.doesNotMatch(script, /innerHTML|eval\(|new Function|localStorage|sessionStorage|sendBeacon/i);
  assert.equal(lab.count(), 0, 'Opening review page must never charge or invoke OpenAI.');
});

test('R79 unauthorized origin, DNS-rebinding Host and public-style requests cannot access private review', async t => {
  const { lab, server } = await withReview(t);
  for (const badHost of ['localhost:4336', 'example.invalid', '127.0.0.1:443']) {
    const result = await rawGet(server, PRIVATE_REVIEW_PAGE_PATH, badHost);
    assert.equal(result.status, 403);
  }
  const crossOrigin = await fetch(server.address + PRIVATE_REVIEW_PAGE_PATH, {
    headers: { Origin: 'https://example.invalid' }
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await fetch(server.address + '/')).status, 404);
  assert.equal((await fetch(server.address + '/favicon.ico')).status, 404);
  assert.equal((await fetch(server.address + '/__faisca_openai_private/respond')).status, 404);
  assert.equal(lab.count(), 0);
});

test('R79 exact same-origin token-authenticated browser request receives only a draft, never an operation', async t => {
  const { lab, server } = await withReview(t);
  const response = await fetch(server.address + server.path, {
    method: 'POST',
    headers: {
      Origin: server.address,
      Authorization: 'Bearer ' + bearer,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ caseId: 'compare' }),
    redirect: 'error',
    credentials: 'omit'
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'draft_answer');
  assert.equal(data.publicReady, false);
  assert.equal(data.operationalEffects, false);
  assert.equal(data.requiresEditorialReview, true);
  assert.equal(data.syntheticCaseId, 'compare');
  assert.match(data.answer, /Onepage/);
  assert.deepEqual(data.models, ['gpt-6-luna', 'gpt-6.1-terra']);
  assert.equal('apiKey' in data, false);
  assert.equal('token' in data, false);
  assert.equal(lab.count(), 1);
});

test('R79 POST denies foreign or malformed origins even when a valid review bearer is present', async t => {
  const { lab, server } = await withReview(t);
  for (const origin of [
    'https://example.invalid', 'http://localhost:4336',
    'null', server.address + '/other', server.address.replace('127.0.0.1', 'localhost')
  ]) {
    const response = await fetch(server.address + server.path, {
      method: 'POST',
      headers: {
        Origin: origin,
        Authorization: 'Bearer ' + bearer,
        'Content-Type': 'application/json'
      },
      body: '{"caseId":"compare"}',
      credentials: 'omit'
    });
    assert.equal(response.status, 403, origin);
  }
  const noToken = await fetch(server.address + server.path, {
    method: 'POST', headers: { Origin: server.address, 'Content-Type': 'application/json' },
    body: '{"caseId":"compare"}'
  });
  assert.equal(noToken.status, 403);
  assert.equal(lab.count(), 0, 'Unauthorized requests may never dispatch an API call.');
});
