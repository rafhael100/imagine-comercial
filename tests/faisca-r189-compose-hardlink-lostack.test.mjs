import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, link, lstat, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const files = Object.freeze([
  'faisca-reservations.json',
  '.faisca-reservations-initialized',
  '.faisca-reservations-highwater.json',
  '.faisca-reservations-highwater-initialized'
]);
const apiKey = 'sk-synthetic-r189-not-real-openai-key-123456';

for (const name of files) {
  test('R189 R186+R188: hardlinked ' + name + ' blocks reserve and dispatch with sanitized error', async () => {
    const root = await mkdtemp(join(tmpdir(), 'faisca-r189-'));
    const directory = join(root, 'ledger');
    await mkdir(directory, { mode: 0o700 });
    try {
      const ledger = createFaiscaLocalReservationLedger({
        directory, maxRequests: 3, maxBudgetUsd: 1
      });
      assert.equal((await ledger.reserve(0.01)).requests, 1);
      await link(join(directory, name), join(root, 'alias-outside-ledger'));
      assert.equal((await lstat(join(directory, name))).nlink, 2);
      await assert.rejects(ledger.ready(), /operator review|unsafe permissions or shape/);

      let dispatches = 0;
      const client = createFaiscaOpenAILiveLab({
        enabled: true, apiKey, extendedPrivateSession: true,
        maxRequests: 3, maxBudgetUsd: 1, reservationLedger: ledger,
        fetchImpl: async () => { dispatches++; throw new Error('transport must remain unreachable'); }
      });
      await assert.rejects(client.answer('compare'), error =>
        error.message === 'OpenAI private test unavailable.');
      await assert.rejects(client.answer('process'), /OpenAI private test unavailable/);
      assert.equal(dispatches, 0);
      assert.equal(client.inspect().calls, 0);
      assert.equal(client.inspect().reservedUsd, 0);
      const state = JSON.parse(await readFile(join(directory, files[0]), 'utf8'));
      assert.equal(state.requests, 1, 'Original durable reservation must not reset');
      await lstat(join(directory, '.faisca-reservations.lock'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('R189 healthy single-link ledger and acknowledged Luna fixture still allow sequential requests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r189-ok-'));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  try {
    const ledger = createFaiscaLocalReservationLedger({
      directory, maxRequests: 3, maxBudgetUsd: 1
    });
    let dispatches = 0;
    const client = createFaiscaOpenAILiveLab({
      enabled: true, apiKey, extendedPrivateSession: true,
      maxRequests: 3, maxBudgetUsd: 1, reservationLedger: ledger,
      fetchImpl: async (url, init) => {
        dispatches++;
        assert.equal(url, 'https://api.openai.com/v1/responses');
        const req = JSON.parse(init.body);
        assert.equal(req.store, false);
        assert.equal(req.model, FAISCA_OPENAI_MODELS.classification);
        return new Response(JSON.stringify({
          model: FAISCA_OPENAI_MODELS.classification,
          status: 'completed',
          output: [{ type: 'message', role: 'assistant',
            content: [{ type: 'output_text', text: '{"answerId":"none"}' }] }],
          usage: { input_tokens: 20, output_tokens: 2 }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    });
    assert.equal((await client.answer('compare')).status, 'unsupported');
    assert.equal((await client.answer('process')).status, 'unsupported');
    assert.equal(dispatches, 2);
    assert.equal((await ledger.inspectReadOnly()).requests, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
