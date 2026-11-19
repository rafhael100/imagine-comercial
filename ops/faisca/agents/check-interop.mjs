import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minimalProcessEnvironment, prepareAgentsBridge } from './php-provider.mjs';
import { createConversationRuntime } from '../conversation-runtime.mjs';
import { conversationFingerprint, createConversationResponse } from '../conversation-contract.mjs';
import { createSession, respond } from '../core.mjs';
import { KNOWLEDGE } from '../knowledge.mjs';
import { parseAgentsOutput } from './protocol.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const reports = resolve(directory, '../reports');
const digest = value => createHash('sha256').update(value).digest('hex');

/** Both QA entrypoints require the independently reviewed, complete checkout. */
export async function readAgentsQaConfiguration() {
  const agentsRoot = process.env.IMAGINE_FAISCA_AGENTS_ROOT;
  if (!agentsRoot || !agentsRoot.trim()) throw new Error('IMAGINE_FAISCA_AGENTS_ROOT is required; PHP execution cannot be skipped.');
  const phpBinary = process.env.IMAGINE_FAISCA_PHP_BINARY ?? 'php';
  if ((phpBinary !== 'php' && !isAbsolute(phpBinary)) || phpBinary.includes('\0')) {
    throw new Error('IMAGINE_FAISCA_PHP_BINARY must be php or an absolute executable path.');
  }
  const pin = JSON.parse(await readFile(resolve(directory, 'pin.json'), 'utf8'));
  assert.match(pin.commit, /^[a-f0-9]{40}$/, 'The reviewed Agents commit must be a complete immutable SHA.');
  assert.equal(pin.knowledgeVersion, KNOWLEDGE.version, 'The Agents pin must match the current editorial version.');
  assert.match(pin.knowledgeDigest, /^[a-f0-9]{64}$/, 'The Agents knowledge digest must be pinned.');
  return { enabled: '1', agentsRoot: resolve(agentsRoot), pin, phpBinary };
}

export async function eventually(predicate, message, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (await predicate()) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 15));
  } while (Date.now() < deadline);
  assert.fail(message);
}

export function bridgeCounts(bridge) {
  const inspection = bridge.inspect();
  const counts = {};
  for (const name of ['spawned', 'completed', 'failed', 'pending', 'rejectedBeforeSpawn']) {
    assert.ok(Number.isSafeInteger(inspection[name]) && inspection[name] >= 0, `Invalid bridge counter: ${name}.`);
    counts[name] = inspection[name];
  }
  return counts;
}

function request(changes = {}) {
  return { schema: 'faisca.conversation.v1', conversationId: 'conversation_r05_synthetic_01',
    messageId: 'message_r05_synthetic_0001', locale: 'pt-BR',
    input: { type: 'action', id: 'goal_presence' }, ...changes };
}

async function cliEnvelope(pin) {
  const envelope = request();
  const candidate = createConversationResponse(envelope, respond(createSession(), envelope.input).reply);
  return { schema: 'faisca.agents.request.v1', invocationId: randomBytes(16).toString('hex'),
    requestFingerprint: await conversationFingerprint(envelope), candidateDigest: digest(JSON.stringify(candidate)),
    conversationId: envelope.conversationId, messageId: envelope.messageId, locale: 'pt-BR',
    context: { scope: 'public_comercial', knowledgeVersion: pin.knowledgeVersion,
      knowledgeDigest: pin.knowledgeDigest, sourceIds: candidate.sources.map(source => source.id),
      actionIds: candidate.actions.map(action => action.id) } };
}

// This is an actual PHP invocation, independent of the Node provider's request
// validation. No fixture executable or JavaScript process substitutes for PHP.
function executePhpCli(configuration, envelope, counters) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(configuration.phpBinary, ['-n', '-d', 'display_errors=stderr', '-d', 'log_errors=0',
      '-d', 'allow_url_fopen=0', '-f', resolve(configuration.agentsRoot, 'tools/faisca_public_bridge.php')], {
      cwd: configuration.agentsRoot, shell: false, detached: false, windowsHide: true,
      env: { ...minimalProcessEnvironment(), IMAGINE_FAISCA_AGENTS_LAB: '1',
        IMAGINE_FAISCA_AGENTS_SCENARIO: 'success', IMAGINE_FAISCA_AGENTS_DELAY_MS: '0' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), failure;
    const fail = message => {
      if (failure) return;
      failure = new Error(message);
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => fail('The real PHP CLI exceeded its bounded execution deadline.'), 4000);
    child.once('spawn', () => { counters.spawned++; });
    child.once('error', () => fail('The real PHP CLI could not start; no substitute execution is permitted.'));
    child.stdin.on('error', () => { /* A refusing child may close its input before Node finishes. */ });
    child.stdout.on('data', bytes => {
      stdout = Buffer.concat([stdout, bytes]);
      if (stdout.length > 16384) fail('The real PHP CLI exceeded its stdout bound.');
    });
    child.stderr.on('data', bytes => {
      stderr = Buffer.concat([stderr, bytes]);
      if (stderr.length > 4096) fail('The real PHP CLI exceeded its stderr bound.');
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (failure) { rejectRun(failure); return; }
      counters.completed++;
      resolveRun({ code, signal, stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8') });
    });
    // The PHP protocol compares its exact compact JSON representation. EOF,
    // rather than an extra newline or a second record, terminates this request.
    child.stdin.end(JSON.stringify(envelope));
  });
}

async function main() {
  let configuration, executedPHP = false, phase = 'preconditions', currentCheck, fatal;
  const results = [], bridgeSummaries = [], cli = { spawned: 0, completed: 0 };
  async function check(name, operation) {
    currentCheck = name;
    await operation();
    results.push({ name, status: 'pass' });
    console.log('PASS ' + name);
    currentCheck = undefined;
  }
  async function withRuntime(options, operation) {
    const bridge = await prepareAgentsBridge({ ...configuration, ...options });
    // Fault cases must reach the hard process deadline before the presentation
    // timeout, so their initial reason is genuinely provider_unknown.
    const runtime = createConversationRuntime({ provider: bridge.createProvider(), timeoutMs: options.timeoutMs ?? 5000 });
    let completed = false;
    try { await operation({ runtime, bridge }); completed = true; }
    finally {
      runtime.destroy();
      await bridge.close();
      await eventually(() => bridgeCounts(bridge).pending === 0, 'Closing the bridge left a PHP child pending.');
      const counts = bridgeCounts(bridge);
      bridgeSummaries.push({ scenario: options.scenario ?? 'success', ...counts });
      if (completed) {
        assert.equal(runtime.inspect().live, false, 'The conversation runtime must be destroyed.');
        assert.equal(runtime.inspect().entries, 0, 'Disposed runtime entries must be released.');
      }
    }
  }
  try {
    configuration = await readAgentsQaConfiguration();
    phase = 'checks';
    await check('an incorrect immutable checkout pin is rejected before any provider is created', async () => {
      const wrong = configuration.pin.commit === '0'.repeat(40) ? '1'.repeat(40) : '0'.repeat(40);
      const firstFile = Object.keys(configuration.pin.files)[0];
      assert.ok(firstFile, 'The reviewed pin must cover the executed PHP files.');
      const wrongDigest = configuration.pin.files[firstFile] === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
      for (const pin of [{ ...configuration.pin, commit: wrong },
        { ...configuration.pin, files: { ...configuration.pin.files, [firstFile]: wrongDigest } }]) {
        await assert.rejects(prepareAgentsBridge({ ...configuration, pin }),
          error => error?.code === 'pin_mismatch', 'A mismatched checkout must fail closed with pin_mismatch.');
      }
    });

    await check('real pinned PHP validates the receipt before the editorial answer is accepted', async () => {
      await withRuntime({ scenario: 'success' }, async ({ runtime, bridge }) => {
        assert.equal(bridgeCounts(bridge).spawned, 0, 'Preparing a bridge cannot dispatch a conversation.');
        const result = await runtime.send(request());
        assert.equal(result.status, 'answered', 'The PHP happy path is required; unavailable cannot count as execution.');
        assert.equal(result.delivery, 'simulated', 'This is a synthetic provider without a model or operational effects.');
        assert.equal(result.operationalEffects, false, 'The receipt cannot authorize an operational effect.');
        assert.match(result.reply.text, /Site Onepage/, 'The response must remain the reviewed editorial candidate.');
        const counts = bridgeCounts(bridge);
        assert.equal(counts.spawned, 1, 'The answer requires exactly one real PHP process.');
        assert.equal(counts.completed, 1, 'The real PHP process must complete before acceptance.');
        assert.equal(counts.pending, 0, 'Successful PHP execution must be drained.');
        executedPHP = true;

        const same = await runtime.send(request());
        const conflict = await runtime.send(request({ input: { type: 'action', id: 'pricing' } }));
        assert.equal(same, result, 'An identical replay must reuse the same result.');
        assert.equal(conflict.status, 'conflict', 'Altered content with the same ID must conflict.');
        assert.equal(bridgeCounts(bridge).spawned, 1, 'Replay and conflict cannot execute another PHP process.');
      });
    });

    await check('the real PHP CLI itself rejects altered knowledge version, digest and source', async () => {
      // prepare independently checks the source pin before this direct CLI path.
      const verified = await prepareAgentsBridge(configuration);
      try {
        const original = await cliEnvelope(configuration.pin);
        const valid = await executePhpCli(configuration, original, cli);
        assert.equal(valid.code, 0, 'The raw PHP protocol baseline must succeed.');
        assert.equal(valid.stderr, '', 'The CLI must keep diagnostics out of a valid protocol exchange.');
        assert.equal(parseAgentsOutput(Buffer.from(valid.stdout), original)?.kind, 'result',
          'The raw PHP protocol baseline must satisfy the complete closed receipt validator.');
        const receipt = JSON.parse(valid.stdout);
        assert.equal(receipt.schema, 'faisca.agents.result.v1', 'The direct CLI must return its versioned PHP receipt.');
        assert.equal(receipt.invocationId, original.invocationId, 'The direct PHP receipt must correlate to this invocation.');
        assert.equal(receipt.requestFingerprint, original.requestFingerprint, 'The direct receipt must bind the request digest.');
        assert.equal(receipt.candidateDigest, original.candidateDigest, 'The direct receipt must bind the candidate digest.');
        assert.equal(receipt.evidence.effects, 0, 'The PHP fixture must perform no operational effects.');
        for (const [changes, expected] of [
          [{ knowledgeVersion: 'SYNTHETIC_UNREVIEWED_VERSION' }, 'context_denied'],
          [{ knowledgeDigest: '0'.repeat(64) }, 'context_denied'],
          [{ sourceIds: ['SYNTHETIC_UNREVIEWED_SOURCE'] }, 'source_denied']
        ]) {
          const result = await executePhpCli(configuration, { ...original, context: { ...original.context, ...changes } }, cli);
          assert.equal(result.code, 2, 'The PHP CLI must explicitly refuse an unreviewed context.');
          assert.equal(result.stderr, '', 'A protocol refusal must not expose diagnostics.');
          assert.deepEqual(JSON.parse(result.stdout), { schema: 'faisca.agents.error.v1', code: expected },
            'The refusal must come from the actual PHP protocol validator.');
        }
      } finally { await verified.close(); }
    });

    await check('soft timeout and early consultation preserve one PHP dispatch until late reconciliation', async () => {
      await withRuntime({ scenario: 'delay', delayMs: 800, timeoutMs: 50 }, async ({ runtime, bridge }) => {
        const initial = await runtime.send(request());
        assert.equal(initial.status, 'unknown', 'A presentation timeout does not confirm failure.');
        assert.equal(initial.reason, 'timeout_after_dispatch', 'The initial uncertainty must identify the postdispatch timeout.');
        await eventually(() => bridgeCounts(bridge).spawned === 1, 'The delayed fixture must actually start PHP before early consultation.');
        assert.equal(bridgeCounts(bridge).completed, 0, 'The early consultation must precede actual PHP completion.');
        assert.equal((await runtime.reconcile(request())).status, 'unknown', 'A consultation cannot invent an early result.');
        assert.equal(bridgeCounts(bridge).spawned, 1, 'Early consultation cannot dispatch PHP again.');
        await eventually(() => bridgeCounts(bridge).completed === 1, 'The real delayed PHP process did not finish.');
        let late;
        await eventually(async () => { late = await runtime.reconcile(request()); return late.status === 'answered'; },
          'The original PHP result did not become reconcilable.');
        assert.match(late.reply.text, /Site Onepage/, 'Reconciliation must release the original reviewed candidate.');
        assert.equal(await runtime.send(request()), initial, 'The initial unknown result remains stable on send replay.');
        assert.equal(runtime.inspect().dispatched, 1, 'Reconciliation cannot redispatch the runtime.');
        assert.equal(bridgeCounts(bridge).spawned, 1, 'Reconciliation cannot spawn another PHP process.');
      });
    });

    for (const options of [
      { scenario: 'delay', delayMs: 1500, processDeadlineMs: 150 },
      { scenario: 'malformed' },
      { scenario: 'exit_after_dispatch' }
    ]) {
      await check(`real PHP ${options.scenario === 'delay' ? 'process deadline' : options.scenario} stays provider_unknown without redispatch`, async () => {
        await withRuntime(options, async ({ runtime, bridge }) => {
          const initial = await runtime.send(request());
          assert.equal(initial.status, 'unknown', 'An unconfirmed PHP execution must not become a known refusal.');
          assert.equal(initial.reason, 'provider_unknown', 'Process uncertainty must preserve its explicit provider_unknown reason.');
          await eventually(() => bridgeCounts(bridge).pending === 0, 'The failed PHP child was not drained.');
          const consulted = await runtime.reconcile(request());
          assert.equal(consulted.status, 'unknown', 'A failed process offers no final result to reconcile.');
          assert.equal(consulted.reason, 'provider_unknown', 'The uncertain result cannot silently become unavailable.');
          assert.equal(await runtime.send(request()), initial, 'An unknown send replay must remain stable.');
          assert.equal(bridgeCounts(bridge).spawned, 1, 'A failed real process must not be respawned automatically.');
        });
      });
    }

    for (const scenario of ['unavailable', 'revoke_before_delivery']) {
      await check(`real PHP ${scenario} returns an explicit refusal and releases no accepted receipt`, async () => {
        await withRuntime({ scenario }, async ({ runtime, bridge }) => {
          const result = await runtime.send(request());
          assert.equal(result.status, 'unavailable', 'A known PHP protocol refusal must be reported as unavailable.');
          assert.equal(result.delivery, 'guided_fallback', 'Only local guidance may follow a known PHP refusal.');
          assert.match(result.reply.text, /indisponível/i, 'The interface must distinguish local guidance from an accepted PHP receipt.');
          assert.equal(bridgeCounts(bridge).spawned, 1, 'The refusal must be exercised by actual PHP.');
          assert.equal(bridgeCounts(bridge).pending, 0, 'The refused process must be drained.');
        });
      });
    }

    await check('disposing a runtime drains its actual pending PHP child and prevents late delivery', async () => {
      await withRuntime({ scenario: 'delay', delayMs: 1500, timeoutMs: 2000 }, async ({ runtime, bridge }) => {
        const work = runtime.send(request());
        await eventually(() => bridgeCounts(bridge).spawned === 1, 'The disposal fixture never started real PHP.');
        runtime.destroy();
        assert.equal((await work).status, 'closed', 'Disposal must close the pending conversation turn.');
        await bridge.close();
        await eventually(() => bridgeCounts(bridge).pending === 0, 'Disposal left an actual PHP child alive.');
        assert.equal((await runtime.reconcile(request())).status, 'closed', 'Disposed work cannot later reenter a conversation.');
        assert.equal(bridgeCounts(bridge).spawned, 1, 'Disposal cannot replay the request.');
      });
    });
    assert.equal(executedPHP, true, 'Passing this suite requires real PHP execution.');
  } catch (error) {
    fatal = { phase, check: currentCheck ?? null, code: error?.code ?? 'qa_failure', message: error.message };
    if (currentCheck) results.push({ name: currentCheck, status: 'fail' });
    process.exitCode = 1;
  } finally {
    await mkdir(reports, { recursive: true });
    await writeFile(resolve(reports, 'Faisca_AGENTS_R05_INTEROP_QA.json'), JSON.stringify({
      status: fatal ? 'failed' : 'passed', executedPHP, phase,
      agentsCommit: configuration?.pin.commit ?? null, knowledgeVersion: configuration?.pin.knowledgeVersion ?? null,
      knowledgeDigest: configuration?.pin.knowledgeDigest ?? null,
      scope: 'Synthetic Node to pinned PHP Agents process; no model, external network or operational authority',
      results, directCli: cli, bridgeSummaries, fatal
    }, null, 2) + '\n');
    console.log(`R05 PHP interop: ${results.filter(result => result.status === 'pass').length}/${results.length} passed; executedPHP=${executedPHP}.`);
    if (fatal) console.error(`${fatal.phase}: ${fatal.check ?? fatal.code}: ${fatal.message}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
