import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

test('R299 actual loopback responses with exact HTML and unexpected browser headers fail closed', async t => {
  let calls = 0;
  const actual = await startFaiscaOpenAIPrivateReview({
    lab: {inspect: () => ({syntheticOnly:true}), answer: async () => { calls++; throw Error('UNEXPECTED_MODEL'); }},
    reviewToken: 'R299_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456'
  });
  t.after(() => actual.close());
  const path = '/__faisca_openai_private/review';
  const response = await fetch(actual.address + path);
  const bytes = Buffer.from(await response.arrayBuffer());
  const headers = Object.fromEntries(response.headers);
  for (const name of ['transfer-encoding','content-length','connection','keep-alive']) delete headers[name];
  const cases = [
    ['refresh', '0; url=https://synthetic.invalid/'],
    ['link', '<https://synthetic.invalid/>; rel=preconnect'],
    ['report-to', '{"group":"synthetic","max_age":10,"endpoints":[{"url":"https://synthetic.invalid/"}]}'],
    ['content-disposition', 'attachment'],
    ['x-unreviewed-fixture', 'synthetic']
  ];
  let extra = cases[0], received = [];
  const server = createServer((req,res) => {
    received.push([req.method,req.url]);
    res.writeHead(200,{...headers,[extra[0]]:extra[1],'content-length':bytes.length});
    res.end(bytes);
  });
  await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  for (const entry of cases) {
    extra = entry;
    const result = await inspectFaiscaPrivateReviewUi({origin});
    assert.equal(result.status,'BLOCKED_PRIVATE_UI_NOT_VERIFIED',entry[0]);
    assert.equal(result.requests,1);
    assert.equal(result.publicReady,false);
    assert.equal(result.modelInvocations,0);
  }
  assert.deepEqual(received,cases.map(() => ['GET',path]));
  const good = await inspectFaiscaPrivateReviewUi({origin:actual.address});
  assert.equal(good.status,'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(good.requests,4);
  assert.equal(calls,0);
});
