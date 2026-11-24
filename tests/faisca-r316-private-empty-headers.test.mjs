import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

test('R316 empty prohibited request headers do not count as absent', async t => {
  let calls = 0;
  const bearer = 'R316_SYNTHETIC_REVIEW_TOKEN_000000000';
  const server = await startFaiscaOpenAIPrivateReview({
    lab: { inspect: () => ({}),
      answer: async () => { calls++; throw Error('unexpected provider call'); } },
    reviewToken: bearer
  });
  t.after(() => server.close());
  for (const header of ['Origin', 'Cookie']) {
    const page = await fetch(server.address + '/__faisca_openai_private/review',
      { headers: { [header]: '' } });
    assert.equal(page.status, 403, header);
    await page.json();
    const post = await fetch(server.address + '/__faisca_openai_private/respond', {
      method: 'POST', headers: { Authorization: 'Bearer ' + bearer,
        'Content-Type': 'application/json', [header]: '' },
      body: JSON.stringify({ caseId: 'compare' })
    });
    assert.equal(post.status, 403, header);
    await post.json();
  }
  for (const header of ['Content-Encoding', 'Trailer']) {
    const post = await fetch(server.address + '/__faisca_openai_private/respond', {
      method: 'POST', headers: { Authorization: 'Bearer ' + bearer,
        'Content-Type': 'application/json', [header]: '' },
      body: JSON.stringify({ caseId: 'compare' })
    });
    assert.equal(post.status, 400, header);
    await post.json();
  }
  for (const headers of [{}, { Origin: server.address }]) {
    const page = await fetch(server.address + '/__faisca_openai_private/review', { headers });
    assert.equal(page.status, 200);
    await page.text();
  }
  assert.equal(calls, 0);
  assert.equal(server.inspect().requests, 0);
});
