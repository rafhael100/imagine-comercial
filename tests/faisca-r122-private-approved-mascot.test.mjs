import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import {
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML, PRIVATE_REVIEW_MASCOT_PATH
} from '../ops/faisca/openai/private-review-page.mjs';

const token = 'R122_PRIVATE_APPROVED_MASCOT_FIXTURE_0123456789';
const digest = '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d';
const lab = {
  answer: () => { throw new Error('R122 must never dispatch a model'); },
  answerPrivateConversation: () => { throw new Error('R122 must never dispatch a model'); },
  inspect: () => ({syntheticOnly: true, externalCalls: 0})
};
test('R122 private browser renders the unchanged, human-approved mascot, never an external image', async t => {
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  for (const html of [PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML]) {
    assert.equal(html.split('src="' + PRIVATE_REVIEW_MASCOT_PATH + '"').length, 2);
    assert.match(html, /alt="Faísca, mascote aprovado da Imagine"/);
    assert.doesNotMatch(html, /https?:\/\//);
  }
  const actual = await fetch(server.address + PRIVATE_REVIEW_MASCOT_PATH, { cache: 'no-store' });
  assert.equal(actual.status, 200);
  assert.equal(actual.headers.get('content-type'), 'image/png');
  assert.equal(actual.headers.get('content-length'), '1887660');
  assert.equal(actual.headers.get('cache-control'), 'no-store, max-age=0');
  assert.match(actual.headers.get('content-security-policy'), /img-src 'self'/);
  assert.equal(actual.headers.get('access-control-allow-origin'), null);
  assert.equal(actual.headers.get('set-cookie'), null);
  const bytes = Buffer.from(await actual.arrayBuffer());
  assert.equal(bytes.byteLength, 1887660);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  assert.equal(bytes.readUInt32BE(16), 1254);
  assert.equal(bytes.readUInt32BE(20), 1254);
  assert.equal(server.inspect().requests, 0);
  assert.equal((await inspectFaiscaPrivateReviewUi({
    origin: server.address, privateConversationEnabled: true
  })).status, 'PRIVATE_UI_READONLY_VERIFIED');

  // Exact path only: no transforms, query URLs, traversal or foreign origins.
  assert.equal((await fetch(server.address + PRIVATE_REVIEW_MASCOT_PATH + '?v=1')).status, 404);
  assert.equal((await fetch(server.address + PRIVATE_REVIEW_MASCOT_PATH, {
    headers: { Origin: 'https://external.invalid' }
  })).status, 403);
  assert.equal(server.inspect().requests, 0);
});
