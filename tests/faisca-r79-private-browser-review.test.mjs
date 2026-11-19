import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  PRIVATE_REVIEW_PAGE_PATH, PRIVATE_REVIEW_SCRIPT_PATH, PRIVATE_REVIEW_STYLE_PATH
} from '../ops/faisca/openai/private-review-page.mjs';

const token = 'R79_ONLY_FOR_PRIVATE_TEST_123456789012';
function provider() {
  let calls = 0;
  return {
    async answer(caseId) {
      calls++;
      return Object.freeze({
        status: 'draft_answer',
        text: 'O Site Onepage apresenta sua empresa e seus serviços. A Landing Page apresenta uma campanha específica; detalhes devem ser confirmados com a Imagine.',
        sourceIds: Object.freeze(['faisca.passage.onepage.description@r06-1']),
        modelIds: Object.freeze(['gpt-6-luna', 'gpt-6.1-terra']),
        publicReady: false, operationalEffects: false
      });
    },
    inspect() { return { calls, moneySpent: false }; }
  };
}

test('R79 GET exposes only a CSP-protected synthetic review screen from exact local host', async t => {
  const server = await startFaiscaOpenAIPrivateReview({ lab: provider(), reviewToken: token });
  t.after(() => server.close());
  const page = await fetch(server.address + PRIVATE_REVIEW_PAGE_PATH);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal(page.headers.get('access-control-allow-origin'), null);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  const html = await page.text();
  for(const label of ['compare','process','pricing']) {
    assert.ok(html.includes('value="' + label + '"'));
  }
  assert.match(html, /FAISCA_REVIEW_BEARER_TOKEN/);
  assert.match(html, /Não.*OPENAI_API_KEY/);
  assert.ok(html.includes('type="password"'));
  assert.ok(!html.includes('onload=') && !html.includes('onclick='));
  assert.equal((await fetch(server.address + PRIVATE_REVIEW_SCRIPT_PATH)).status, 200);
  const script = await (await fetch(server.address + PRIVATE_REVIEW_SCRIPT_PATH)).text();
  assert.match(script, /textContent = data\.answer/);
  assert.match(script, /credentials:'omit'/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|document\.cookie|innerHTML|eval\(/);
  assert.equal((await fetch(server.address + PRIVATE_REVIEW_STYLE_PATH)).status, 200);
  assert.equal((await fetch(server.address + server.path)).status, 404,
    'A public GET cannot dispatch the model.');
  assert.equal(server.inspect().requests, 0);
});

test('R79 same-origin browser POST is allowed, cross-origin browser POST refused', async t => {
  const lab = provider();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const origin = server.address;
  const base = {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{"caseId":"compare"}'
  };
  const remote = await fetch(origin + server.path, {
    ...base, headers: { ...base.headers, Origin: 'https://example.invalid' }
  });
  assert.equal(remote.status, 403);
  const spoofed = await fetch(origin + PRIVATE_REVIEW_PAGE_PATH, {
    headers: { Origin: 'https://example.invalid' }
  });
  assert.equal(spoofed.status, 403);
  const cookie = await fetch(origin + server.path, {
    ...base, headers: { ...base.headers, Origin: origin, Cookie: 'session=fake' }
  });
  assert.equal(cookie.status, 403);
  const valid = await fetch(origin + server.path, {
    ...base, headers: { ...base.headers, Origin: origin }
  });
  assert.equal(valid.status, 200);
  const response = await valid.json();
  assert.equal(response.status, 'draft_answer');
  assert.equal(response.publicReady, false);
  assert.equal(response.operationalEffects, false);
  assert.equal(response.requiresEditorialReview, true);
  assert.deepEqual(response.models, ['gpt-6-luna', 'gpt-6.1-terra']);
  assert.equal(server.inspect().requests, 1);
  assert.equal(lab.inspect().calls, 1);
});

test('R79 UI routes do not accept POST and private model endpoint never accepts arbitrary text', async t => {
  const lab = provider();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const base = { method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
  };
  const uiPost = await fetch(server.address + PRIVATE_REVIEW_PAGE_PATH, {
    ...base, body: '{"caseId":"compare"}'
  });
  assert.equal(uiPost.status, 404);
  const raw = await fetch(server.address + server.path, {
    ...base, body: '{"userText":"Quanto custa para mim?"}'
  });
  assert.equal(raw.status, 400);
  assert.equal(server.inspect().requests, 0);
  assert.equal(lab.inspect().calls, 0);
});
