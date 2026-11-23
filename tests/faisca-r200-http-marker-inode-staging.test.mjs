import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rename, writeFile, symlink, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const markerName = '.faisca-provider-dispatch-inflight';
const markerData = 'faisca.private-provider-dispatch-inflight.v1\n';
const token = 'R200_SYNTHETIC_PRIVATE_HTTP_REVIEW_TOKEN_12345678';
const fakeKey = 'sk-r200-synthetic-fixture-not-a-real-key-123456';

function lunaResponse(model) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify({ topic: 'general' }) }] }],
    usage: { input_tokens: 25, output_tokens: 10 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function post(server) {
  return fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
}

for (const tamper of ['replace-with-identical-bytes', 'replace-with-symlink']) {
  test('R200 private HTTP NO-START after Luna marker tamper: ' + tamper, async t => {
    const root = await mkdtemp(join(tmpdir(), 'faisca-r200-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = join(root, 'ledger');
    await mkdir(directory, { mode: 0o700 });
    const marker = join(directory, markerName);
    const make = () => createFaiscaLocalReservationLedger({
      directory, maxRequests: 8, maxBudgetUsd: 1
    });
    let sent = 0, afterRestartSent = 0;
    const transport = async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const request = JSON.parse(options.body);
      assert.equal(request.store, false);
      assert.deepEqual(request.tools, []);
      sent++;
      assert.equal(sent, 1, 'Terra must never receive a second request');
      assert.equal(request.model, FAISCA_OPENAI_MODELS.classification);
      await rename(marker, marker + '.saved');
      if (tamper === 'replace-with-symlink') {
        await symlink(marker + '.saved', marker);
      } else {
        await writeFile(marker, markerData, { flag: 'wx', mode: 0o600 });
      }
      return lunaResponse(request.model);
    };
    const lab = transportFn => createFaiscaOpenAILiveLab({
      enabled: true, apiKey: fakeKey, fetchImpl: transportFn,
      enablePrivateConversation: true, extendedPrivateSession: true,
      timeoutMs: 1000, maxRequests: 8, maxBudgetUsd: 1,
      reservationLedger: make()
    });
    const first = await startFaiscaOpenAIPrivateReview({
      lab: lab(transport), reviewToken: token, enablePrivateConversation: true
    });
    t.after(() => first.close());

    const reply = await post(first);
    assert.equal(reply.status, 503);
    assert.equal(reply.headers.get('access-control-allow-origin'), null);
    const text = await reply.text();
    assert.equal(JSON.parse(text).status, 'unavailable');
    assert.doesNotMatch(text, /landing page|sk-r200|r200_synthetic|marker|inode|luna|terra/i);
    assert.equal(sent, 1);
    assert.equal(first.inspect().providerUnavailable, true);
    assert.equal(await readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
      'faisca.private-provider-outcome-uncertain.v1\n');
    assert.equal((await make().inspectReadOnly()).requests, 1,
      'R269 stops after Luna: an invalid dispatch marker may not reserve unsent Terra');
    await first.close();

    const restarted = await startFaiscaOpenAIPrivateReview({
      lab: lab(async () => {
        afterRestartSent++;
        throw Error('No transport after uncertain marker');
      }), reviewToken: token, enablePrivateConversation: true
    });
    t.after(() => restarted.close());
    const again = await post(restarted);
    assert.equal(again.status, 503);
    assert.equal((await again.json()).status, 'unavailable');
    assert.equal(afterRestartSent, 0);
    assert.equal((await make().inspectReadOnly()).requests, 1);
    await assert.rejects(make().ready(), /operator reconciliation|operator review/);
  });
}
