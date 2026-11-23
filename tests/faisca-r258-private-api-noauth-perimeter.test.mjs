import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewFaiscaPrivateApiAnonymousBoundary as review } from
  '../ops/faisca/openai/review-private-api-noauth.mjs';
import { startFaiscaOpenAIPrivateReview } from
  '../ops/faisca/openai/private-review-http.mjs';

const HOLD = /R258: private API anonymous route boundary unverified \(HOLD\)/;
const BODY = '{"status":"not_found"}\n';
const REQUIRED = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Content-Type': 'application/json; charset=utf-8'
};

async function fixture(t, mutate = () => {}) {
  const visits = [];
  const server = createServer((req, res) => {
    visits.push({ method: req.method, url: req.url, headers: req.headers });
    const reply = { status: 404, headers: { ...REQUIRED }, body: BODY };
    mutate(reply, req);
    res.writeHead(reply.status, reply.headers);
    res.end(reply.body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { visits, port: server.address().port };
}

test('R258 real R95 API server: no-auth GET/OPTIONS never reach synthetic provider', async t => {
  for (const conversation of [false, true]) {
    await t.test('private conversation flag ' + conversation, async sub => {
      let dispatched = 0;
      const lab = {
        answer: async () => { dispatched++; throw Error('unexpected dispatch'); },
        answerPrivateConversation: async () => { dispatched++; throw Error('unexpected dispatch'); },
        inspect: () => ({ requests: 0 })
      };
      const server = await startFaiscaOpenAIPrivateReview({
        lab, reviewToken: 'a'.repeat(40), port: 0,
        enablePrivateConversation: conversation
      });
      sub.after(async () => server.close());
      const result = await review({ port: Number(new URL(server.address).port) });
      assert.equal(result.negativeRouteChecks, 4);
      assert.equal(result.noPostRequestsSent, true);
      assert.equal(result.noOperatorTextSent, true);
      assert.equal(result.authenticatedConversationVerified, false);
      assert.equal(result.publicFaiscaEnabled, false);
      assert.ok(Object.isFrozen(result));
      assert.equal(dispatched, 0);
    });
  }
});

test('R258 synthetic HTTP makes four fixed requests, no POST, token or question', async t => {
  const { port, visits } = await fixture(t);
  const result = await review({ port });
  assert.equal(result.status, 'PRIVATE_API_GET_OPTIONS_NOT_FOUND_REVIEW_ONLY');
  assert.deepEqual(visits.map(v => [v.method, v.url]), [
    ['GET', '/__faisca_openai_private/respond'],
    ['OPTIONS', '/__faisca_openai_private/respond'],
    ['GET', '/__faisca_openai_private/converse'],
    ['OPTIONS', '/__faisca_openai_private/converse']
  ]);
  assert.ok(visits.every(v => !v.headers.authorization && !v.headers.cookie &&
    v.headers.origin === 'https://synthetic-preflight.invalid' &&
    v.headers.host === '127.0.0.1:' + port));
  assert.doesNotMatch(JSON.stringify(result), /synthetic-preflight|respond|converse/);
});

test('R258 any anonymous API response that deviates from reviewed shape is HOLD', async t => {
  const variants = [
    r => { r.status = 200; },
    r => { r.status = 403; },
    r => { r.status = 302; r.headers.Location = 'https://synthetic.invalid'; },
    r => { r.headers['Access-Control-Allow-Origin'] = '*'; },
    r => { r.headers['Access-Control-Allow-Credentials'] = 'true'; },
    r => { r.headers['Set-Cookie'] = 'session=synthetic'; },
    r => { r.headers.Link = '<https://synthetic.invalid/a>; rel=preload'; },
    r => { r.headers['Content-Security-Policy'] = "default-src *"; },
    r => { r.headers['Content-Type'] = 'text/html'; },
    r => { r.headers['Content-Length'] = '50000'; },
    r => { r.body = '{"status":"not_found","token":"synthetic"}\n'; },
    r => { r.body = '<script>synthetic</script>'; },
    r => { r.body = 'x'.repeat(257); }
  ];
  for (const mutate of variants) {
    await t.test('mutated route => stop at first response', async sub => {
      const { port, visits } = await fixture(sub, (reply, req) => {
        if (req.url === '/__faisca_openai_private/respond') mutate(reply);
      });
      await assert.rejects(review({ port }), HOLD);
      assert.equal(visits.length, 1);
    });
  }
});

test('R258 rejects arbitrary port and CLI invocation without opt-in', async () => {
  for (const port of [-1, 0, 65536, '4336', null, NaN, 1.5]) {
    await assert.rejects(review({ port }), HOLD);
  }
  const cli = fileURLToPath(new URL('../scripts/faisca-review-private-api-noauth.mjs', import.meta.url));
  for (const { args, env } of [
    { args: ['https://synthetic.invalid'], env: {} },
    { args: [], env: { CI: 'true' } },
    { args: [], env: { GITHUB_ACTIONS: 'true' } },
    { args: [], env: { IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '' } }
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      encoding: 'utf8', timeout: 8000,
      env: {
        ...process.env, CI: '', GITHUB_ACTIONS: '',
        IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1', ...env
      }
    });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr,
      'R258: private API anonymous route boundary unverified (HOLD)\n');
  }
});
