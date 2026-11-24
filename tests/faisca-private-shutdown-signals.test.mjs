import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

const moduleUrl = new URL('../ops/faisca/openai/private-shutdown.mjs', import.meta.url).href;

for (const safe of [true, false]) {
  test('R346 real process signals during private drain: ' + safe,
    { skip: process.platform === 'win32', timeout: 10000 }, async t => {
      const source = `
        import { createFaiscaPrivateShutdown, bindFaiscaPrivateShutdownSignals } from ${JSON.stringify(moduleUrl)};
        let release;
        const drain = new Promise(resolve => { release = resolve; });
        const shutdown = createFaiscaPrivateShutdown({
          server: {
            close() { console.log('DRAIN'); return drain; },
            inspect: () => ({ active: false, inFlight: false, providerUnavailable: !${safe} })
          },
          ledger: { ready: () => true },
          report: status => console.log(status)
        });
        bindFaiscaPrivateShutdownSignals({ target: process, shutdown });
        process.on('SIGINT', () => console.log('INT'));
        process.on('SIGTERM', () => console.log('TERM'));
        process.stdin.once('data', () => { process.stdin.pause(); release(); });
        process.stdin.resume();
        console.log('READY');
      `;
      // Only an isolated fixture child, with no inherited credential environment.
      const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
        env: {}, stdio: ['pipe', 'pipe', 'pipe']
      });
      const reader = createInterface({ input: child.stdout });
      const lines = reader[Symbol.asyncIterator]();
      const exit = once(child, 'exit');
      t.after(() => {
        reader.close();
        child.stdin.destroy();
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
      const line = async expected => {
        const next = await lines.next();
        assert.equal(next.done, false);
        assert.equal(next.value, expected);
      };
      await line('READY');
      assert.equal(child.kill('SIGINT'), true);
      await line('INT');
      await line('DRAIN');
      assert.equal(child.kill('SIGINT'), true);
      await line('INT');
      assert.equal(child.kill('SIGTERM'), true);
      await line('TERM');
      assert.equal(child.kill('SIGTERM'), true);
      await line('TERM');
      child.stdin.end('release');
      await line(safe ? 'PRIVATE_SHUTDOWN_LOCAL_DRAIN_VERIFIED'
        : 'PRIVATE_SHUTDOWN_RECONCILIATION_REQUIRED');
      assert.deepEqual(await exit, [safe ? 0 : 1, null]);
      assert.equal((await lines.next()).done, true);
    });
}
