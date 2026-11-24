import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rename, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const markerName = '.faisca-provider-dispatch-inflight';
const markerData = 'faisca.private-provider-dispatch-inflight.v1\n';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r199-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  return {
    directory,
    marker: join(directory, markerName),
    make: () => createFaiscaLocalReservationLedger({
      directory, maxRequests: 8, maxBudgetUsd: 1
    })
  };
}

test('R199 same-content replacement inode cannot be reused or released by original owner', async t => {
  const { marker, make } = await setup(t);
  const owner = make(), competitor = make();
  await owner.reserve(0.01);
  assert.equal(await owner.beginPaidDispatch(), true);
  await rename(marker, marker + '.retained');
  await writeFile(marker, markerData, { flag: 'wx', mode: 0o600 });
  await assert.rejects(owner.beginPaidDispatch(), /operator review/);
  await assert.rejects(owner.completePaidDispatch(), /operator review/);
  await assert.rejects(competitor.ready(), /operator review/);
  await assert.rejects(competitor.reserve(0.01), /operator review/);
  assert.equal((await competitor.inspectReadOnly()).requests, 1);
});

test('R199 symlink replacement cannot be reused or unlocked, even when target bytes match', async t => {
  const { marker, make } = await setup(t);
  const owner = make();
  await owner.reserve(0.01);
  await owner.beginPaidDispatch();
  await rename(marker, marker + '.retained');
  await symlink(marker + '.retained', marker);
  await assert.rejects(owner.beginPaidDispatch(), /operator review/);
  await assert.rejects(owner.completePaidDispatch(), /operator review/);
});

test('R199 untouched original inode supports Luna/Terra reuse and explicit release', async t => {
  const { marker, make } = await setup(t);
  const owner = make(), competitor = make();
  await owner.reserve(0.01);
  await owner.beginPaidDispatch();
  await owner.reserve(0.02);
  assert.equal(await owner.beginPaidDispatch(), true);
  await assert.rejects(competitor.beginPaidDispatch(), /unavailable/);
  assert.equal(await owner.completePaidDispatch(), true);
  assert.equal(await competitor.ready(), true);
  assert.equal((await competitor.inspectReadOnly()).requests, 2);
});

test('R199 live provider adapter never sends Terra after dispatch inode substitution', async t => {
  const { marker, make } = await setup(t);
  let calls = 0;
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const input = JSON.parse(options.body);
    assert.equal(input.store, false);
    assert.deepEqual(input.tools, []);
    calls++;
    if (calls === 1) {
      await rename(marker, marker + '.retained');
      await writeFile(marker, markerData, { flag: 'wx', mode: 0o600 });
    }
    const output = input.model === FAISCA_OPENAI_MODELS.classification
      ? { topic: 'general' }
      : { reply: 'Uma landing page pode explicar um evento e orientar o visitante.' };
    return new Response(JSON.stringify({
      model: input.model, status: 'completed',
      output: [{ type: 'message', role: 'assistant', content: [
        { type: 'output_text', text: JSON.stringify(output) }
      ] }],
      usage: { input_tokens: 30, output_tokens: 10 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r199-synthetic-fixture-no-real-key-1234',
    fetchImpl, timeoutMs: 1000, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 8, maxBudgetUsd: 1,
    reservationLedger: make()
  });
  await assert.rejects(lab.answerPrivateConversation({
    scope: 'local_operator_lab', attestedSynthetic: true, question
  }, { requireHttpDeliveryAck: true }), /OpenAI private test unavailable/);
  assert.equal(calls, 1, 'never send Terra after substituted local lock');
  await assert.rejects(make().ready(), /operator reconciliation|operator review/);
  await assert.rejects(lab.answerPrivateConversation({
    scope: 'local_operator_lab', attestedSynthetic: true, question
  }), /OpenAI private test unavailable/);
  assert.equal(calls, 1);
});
