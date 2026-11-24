import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createFaiscaPrivateShutdown, bindFaiscaPrivateShutdownSignals } from '../ops/faisca/openai/private-shutdown.mjs';

const clean = { active: false, inFlight: false, providerUnavailable: false };
test('private shutdown waits for drain, checks ledger once and coalesces signals', async () => {
  let release;
  const drained = new Promise(resolve => { release = resolve; });
  let closes = 0, reads = 0;
  const reports = [];
  const stop = createFaiscaPrivateShutdown({
    server: { close() { closes++; return drained; }, inspect: () => clean },
    ledger: { ready() { reads++; return true; } },
    report: code => reports.push(code)
  });
  const first = stop();
  assert.equal(stop(), first);
  await Promise.resolve();
  assert.equal(closes, 1);
  assert.equal(reads, 0);
  assert.deepEqual(reports, []);
  release();
  assert.equal(await first, 0);
  assert.equal(reads, 1);
  assert.deepEqual(reports, ['PRIVATE_SHUTDOWN_LOCAL_DRAIN_VERIFIED']);
});

for (const [name, state, ready] of [
  ['latched provider', { ...clean, providerUnavailable: true }, () => true],
  ['in-flight work', { ...clean, inFlight: true }, () => true],
  ['active server', { ...clean, active: true }, () => true],
  ['negative ledger result', clean, () => false],
  ['missing ledger affirmation', clean, () => undefined],
  ['ledger failure', clean, () => { throw new Error('synthetic private details'); }]
]) {
  test('private shutdown requires reconciliation: ' + name, async () => {
    const reports = [];
    const stop = createFaiscaPrivateShutdown({
      server: { close: async () => {}, inspect: () => state },
      ledger: { ready }, report: code => reports.push(code)
    });
    assert.equal(await stop(), 1);
    assert.deepEqual(reports, ['PRIVATE_SHUTDOWN_RECONCILIATION_REQUIRED']);
  });
}
test('close failure cannot produce a successful shutdown or ledger read', async () => {
  let reads = 0;
  const reports = [];
  const stop = createFaiscaPrivateShutdown({
    server: { close: async () => { throw new Error('synthetic secret'); }, inspect: () => clean },
    ledger: { ready: () => { reads++; return true; } },
    report: code => reports.push(code)
  });
  assert.equal(await stop(), 1);
  assert.equal(reads, 0);
  assert.deepEqual(reports, ['PRIVATE_SHUTDOWN_RECONCILIATION_REQUIRED']);
});

test('R345 repeated and mixed signals preserve the same pending shutdown and fail-closed exit', async () => {
  const target = new EventEmitter();
  let release, calls = 0;
  const drained = new Promise(resolve => { release = resolve; });
  const stop = bindFaiscaPrivateShutdownSignals({
    target, shutdown: () => { calls++; return drained; }
  });
  target.emit('SIGINT');
  assert.equal(target.exitCode, 1);
  target.emit('SIGINT');
  target.emit('SIGTERM');
  target.emit('SIGTERM');
  const pending = stop();
  assert.equal(stop(), pending);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(target.listenerCount('SIGINT'), 1);
  assert.equal(target.listenerCount('SIGTERM'), 1);
  release(0);
  assert.equal(await pending, 0);
  target.emit('SIGINT');
  assert.equal(target.exitCode, 0);
  assert.equal(calls, 1);
});

test('R345 rejection is reported once without exposing private details', async () => {
  const target = new EventEmitter();
  const reports = [];
  let calls = 0;
  const stop = bindFaiscaPrivateShutdownSignals({
    target, shutdown: async () => { calls++; throw new Error('synthetic private detail'); },
    reportFailure: status => reports.push(status)
  });
  target.emit('SIGTERM');
  target.emit('SIGTERM');
  target.emit('SIGINT');
  assert.equal(await stop(), 1);
  assert.equal(target.exitCode, 1);
  assert.equal(calls, 1);
  assert.deepEqual(reports, ['PRIVATE_SHUTDOWN_RECONCILIATION_REQUIRED']);
});
