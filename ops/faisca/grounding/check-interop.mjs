import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { minimalProcessEnvironment } from '../agents/php-provider.mjs';
import { bridgeCounts, eventually } from '../agents/check-interop.mjs';
import { createConversationRuntime } from '../conversation-runtime.mjs';
import { createConversationResponse } from '../conversation-contract.mjs';
import { CATALOG, CATALOG_SHA256 } from './catalog.mjs';
import { getGroundedAnswer, groundedRespond } from './guide.mjs';
import { prepareGroundedBridge } from './php-provider.mjs';
import { GROUNDED_ENTRYPOINT, GROUNDED_CATALOG_PATH, GROUNDED_REQUIRED_FILES,
  createGroundedRequest, parseGroundedOutput } from './protocol.mjs';

export { bridgeCounts, eventually };
const directory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(directory, '../../..');
const reportPath = resolve(directory, '../reports/Faisca_GROUNDING_R06_INTEROP_QA.json');

export async function readGroundedQaConfiguration() {
  const agentsRoot = process.env.IMAGINE_FAISCA_AGENTS_ROOT;
  const phpBinary = process.env.IMAGINE_FAISCA_PHP_BINARY ?? 'php';
  if (!agentsRoot?.trim()) throw new Error('A pinned Agents checkout is required; real PHP cannot be skipped.');
  if ((phpBinary !== 'php' && !isAbsolute(phpBinary)) || phpBinary.includes('\0')) throw new Error('Invalid trusted PHP executable.');
  const pin = JSON.parse(await readFile(resolve(directory, 'pin.json'), 'utf8'));
  assert.equal(pin.files[GROUNDED_CATALOG_PATH], CATALOG_SHA256, 'Both repositories must use the same exact catalog bytes.');
  return { enabled: '1', agentsRoot: resolve(agentsRoot), pin, phpBinary };
}

const request = (changes = {}) => ({ schema: 'faisca.conversation.v1', conversationId: 'conversation_r06_synthetic_01',
  messageId: 'message_r06_synthetic_0001', locale: 'pt-BR', input: { type: 'action', id: 'goal_presence' }, ...changes });

function executePhp(configuration, wire, cli, { scenario = 'success', enabled = true } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(configuration.phpBinary, ['-n', '-d', 'display_errors=stderr', '-d', 'log_errors=0',
      '-d', 'allow_url_fopen=0', '-f', resolve(configuration.agentsRoot, GROUNDED_ENTRYPOINT)], {
      cwd: configuration.agentsRoot, shell: false, detached: false, windowsHide: true,
      env: { ...minimalProcessEnvironment(), IMAGINE_FAISCA_AGENTS_LAB: '1',
        ...(enabled ? { IMAGINE_FAISCA_GROUNDED_LAB: '1' } : {}), IMAGINE_FAISCA_AGENTS_SCENARIO: scenario,
        IMAGINE_FAISCA_AGENTS_DELAY_MS: '0' }, stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), failure;
    const fail = message => { if (failure) return; failure = new Error(message); child.kill('SIGKILL'); };
    const timer = setTimeout(() => fail('The real grounded PHP process exceeded its deadline.'), 4000);
    child.once('spawn', () => { cli.spawned++; });
    child.once('error', () => fail('Real PHP could not start; no fixture or skip is permitted.'));
    child.stdin.on('error', () => {});
    child.stdout.on('data', bytes => {
      stdout = Buffer.concat([stdout, bytes]);
      if (stdout.length > 16384) fail('Grounded PHP stdout exceeded its limit.');
    });
    child.stderr.on('data', bytes => {
      stderr = Buffer.concat([stderr, bytes]);
      if (stderr.length > 4096) fail('Grounded PHP stderr exceeded its limit.');
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (failure) { rejectRun(failure); return; }
      cli.completed++;
      resolveRun({ code, signal, stdout, stderr });
    });
    child.stdin.end(JSON.stringify(wire));
  });
}

async function copyFiles(from, to, files) {
  for (const path of files) {
    await mkdir(dirname(join(to, path)), { recursive: true });
    await copyFile(join(from, path), join(to, path));
  }
}

// A small isolated consumer copy allows provenance corruption without writing
// into the reviewed checkout or altering another concurrent QA process.
const consumerFiles = ['ops/faisca/core.mjs', 'ops/faisca/knowledge.mjs', 'ops/faisca/conversation-contract.mjs',
  'ops/faisca/agents/protocol.mjs', 'ops/faisca/agents/php-provider.mjs',
  'ops/faisca/grounding/catalog.json', 'ops/faisca/grounding/catalog.mjs', 'ops/faisca/grounding/guide.mjs',
  'ops/faisca/grounding/protocol.mjs', 'ops/faisca/grounding/php-provider.mjs', ...Object.keys(CATALOG.sourceSnapshot.files)];

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
    const bridge = await prepareGroundedBridge({ ...configuration, ...options });
    const runtime = createConversationRuntime({ provider: bridge.createProvider(), prepareTurn: groundedRespond,
      timeoutMs: options.timeoutMs ?? 5000 });
    try { await operation({ runtime, bridge }); }
    finally {
      runtime.destroy(); await bridge.close();
      assert.equal(bridgeCounts(bridge).pending, 0, 'Closing the bridge must drain every owned PHP child.');
      bridgeSummaries.push({ scenario: options.scenario ?? 'success', ...bridgeCounts(bridge) });
    }
  }
  async function wireFor(answerId = 'goal_presence') {
    const req = request({ input: { type: 'action', id: answerId } });
    const candidate = createConversationResponse(req, getGroundedAnswer(answerId));
    return createGroundedRequest(req, candidate, { ...configuration.pin, invocationId: randomBytes(16).toString('hex') });
  }
  async function expectCliError(wire, code, options) {
    const result = await executePhp(configuration, wire, cli, options);
    assert.equal(result.code, 2, 'The real PHP worker must explicitly refuse this request.');
    assert.equal(result.stderr.length, 0, 'A refusal must not expose diagnostics.');
    assert.equal(result.stdout.toString('utf8'), JSON.stringify({ schema: 'faisca.grounded.error.v1', code }) + '\n');
  }
  try {
    configuration = await readGroundedQaConfiguration();
    phase = 'checks';
    await check('checkout pins, catalog bytes and all three commercial source files are verified before dispatch', async () => {
      for (const pin of [{ ...configuration.pin, commit: '0'.repeat(40) },
        { ...configuration.pin, files: { ...configuration.pin.files, [GROUNDED_CATALOG_PATH]: '0'.repeat(64) } }]) {
        await assert.rejects(prepareGroundedBridge({ ...configuration, pin }), { code: 'pin_mismatch' });
      }
      const isolated = await mkdtemp(join(tmpdir(), 'faisca-r06-source-proof-'));
      try {
        await copyFiles(repositoryRoot, isolated, consumerFiles);
        const { prepareGroundedBridge: prepareCopy } = await import(pathToFileURL(join(isolated, 'ops/faisca/grounding/php-provider.mjs')));
        const baseline = await prepareCopy(configuration);
        assert.equal(bridgeCounts(baseline).spawned, 0); await baseline.close();
        for (const path of ['ops/faisca/grounding/catalog.json', ...Object.keys(CATALOG.sourceSnapshot.files)]) {
          const target = join(isolated, path), original = await readFile(target);
          await writeFile(target, Buffer.concat([original, Buffer.from('\n')]));
          await assert.rejects(prepareCopy(configuration), { code: 'pin_mismatch' }, path);
          await writeFile(target, original);
        }
      } finally { await rm(isolated, { recursive: true, force: true }); }
    });
    await check('real PHP retrieves the exact supporting passages and the runtime reuses one confirmed dispatch', async () => {
      await withRuntime({}, async ({ runtime, bridge }) => {
        const result = await runtime.send(request());
        assert.equal(result.status, 'answered'); assert.equal(result.delivery, 'simulated');
        assert.equal(result.reply.text, getGroundedAnswer('goal_presence').text);
        assert.deepEqual(result.reply.sources.map(source => source.id), getGroundedAnswer('goal_presence').sources.map(source => source.id));
        assert.equal(bridgeCounts(bridge).spawned, 1); assert.equal(bridgeCounts(bridge).completed, 1);
        executedPHP = true;
        assert.equal(await runtime.send(request()), result);
        assert.equal((await runtime.send(request({ input: { type: 'action', id: 'channel_meta' } }))).status, 'conflict');
        assert.equal(bridgeCounts(bridge).spawned, 1, 'Replay/conflict cannot execute PHP again.');
      });
    });
    await check('the real PHP contract recomposes all eleven recipes and refuses unrelated valid passages or invented candidates', async () => {
      for (const answer of CATALOG.answers) {
        const wire = await wireFor(answer.id);
        const result = await executePhp(configuration, wire, cli);
        assert.equal(result.code, 0, answer.id); assert.equal(result.stderr.length, 0, answer.id);
        const parsed = parseGroundedOutput(result.stdout, wire, configuration.pin);
        assert.equal(parsed?.kind, 'result', answer.id);
        assert.equal(parsed.value.grounding.text, getGroundedAnswer(answer.id).text, answer.id);
        assert.deepEqual(parsed.value.grounding.passageIds, answer.passageIds, answer.id);
      }
      const wire = await wireFor();
      await expectCliError(wire, 'lab_disabled', { enabled: false });
      await expectCliError({ ...wire, context: { scope: 'public_comercial' } }, 'invalid_request');
      await expectCliError({ ...wire, candidateDigest: '0'.repeat(64) }, 'grounding_denied');
      for (const change of [{ passageIds: ['meta.approach'] }, { passageIds: ['onepage.description', 'onepage.description'] },
        { answerId: 'channel_meta' }, { catalogDigest: '0'.repeat(64) }, { catalogVersion: 'faisca-grounding-2' }]) {
        await expectCliError({ ...wire, grounding: { ...wire.grounding, ...change } }, 'grounding_denied');
      }
    });
    await check('real PHP refuses a changed catalog even when invoked directly outside Node pin validation', async () => {
      const isolated = await mkdtemp(join(tmpdir(), 'faisca-r06-php-catalog-'));
      try {
        await copyFiles(configuration.agentsRoot, isolated, GROUNDED_REQUIRED_FILES);
        const catalog = join(isolated, GROUNDED_CATALOG_PATH);
        const original = await readFile(catalog, 'utf8');
        const changed = original.replace('Site Onepage: apresentação', 'Site Onepage: alterado');
        assert.notEqual(changed, original, 'The negative fixture must actually change the pinned catalog.');
        await writeFile(catalog, changed);
        const result = await executePhp({ ...configuration, agentsRoot: isolated }, await wireFor(), cli);
        assert.equal(result.code, 2); assert.equal(result.stderr.length, 0);
        assert.equal(result.stdout.toString('utf8'), JSON.stringify({ schema: 'faisca.grounded.error.v1', code: 'grounding_denied' }) + '\n');
      } finally { await rm(isolated, { recursive: true, force: true }); }
    });
    await check('a delayed grounded PHP result is reconciled from the original execution and original passages', async () => {
      await withRuntime({ scenario: 'delay', delayMs: 800, timeoutMs: 50 }, async ({ runtime, bridge }) => {
        const initial = await runtime.send(request());
        assert.equal(initial.status, 'unknown');
        await eventually(() => bridgeCounts(bridge).spawned === 1, 'The delayed fixture must start real PHP.');
        assert.equal(bridgeCounts(bridge).completed, 0);
        assert.equal((await runtime.reconcile(request())).status, 'unknown');
        await eventually(() => bridgeCounts(bridge).completed === 1, 'The original grounded PHP result did not arrive.');
        const final = await runtime.reconcile(request());
        assert.equal(final.status, 'answered'); assert.equal(final.reply.text, getGroundedAnswer('goal_presence').text);
        assert.equal(await runtime.send(request()), initial); assert.equal(bridgeCounts(bridge).spawned, 1);
      });
    });
    await check('revoked grants and disabled selected sources prevent grounded delivery after real PHP selection', async () => {
      for (const scenario of ['revoke_before_delivery', 'source_disabled_before_delivery']) {
        await withRuntime({ scenario }, async ({ runtime, bridge }) => {
          const result = await runtime.send(request());
          assert.equal(result.status, 'unavailable'); assert.equal(result.delivery, 'guided_fallback');
          assert.equal(bridgeCounts(bridge).spawned, 1); assert.equal(bridgeCounts(bridge).completed, 0);
          assert.equal(bridgeCounts(bridge).pending, 0);
          assert.equal(await runtime.send(request()), result); assert.equal(bridgeCounts(bridge).spawned, 1);
        });
      }
    });
    await check('lost, malformed or expired process output stays unknown and never redispatches the grounded turn', async () => {
      for (const options of [{ scenario: 'malformed' }, { scenario: 'exit_after_dispatch' },
        { scenario: 'delay', delayMs: 1500, processDeadlineMs: 150 }]) {
        await withRuntime(options, async ({ runtime, bridge }) => {
          const initial = await runtime.send(request());
          assert.equal(initial.status, 'unknown'); assert.equal(initial.reason, 'provider_unknown');
          assert.equal((await runtime.reconcile(request())).reason, 'provider_unknown');
          assert.equal(await runtime.send(request()), initial); assert.equal(bridgeCounts(bridge).spawned, 1);
          assert.equal(bridgeCounts(bridge).pending, 0);
        });
      }
    });
    assert.equal(executedPHP, true, 'This suite requires actual PHP execution and an accepted grounded result.');
  } catch (error) {
    fatal = { phase, check: currentCheck ?? null, code: error?.code ?? 'qa_failure', message: error.message };
    if (currentCheck) results.push({ name: currentCheck, status: 'fail' });
    process.exitCode = 1;
  } finally {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify({ status: fatal ? 'failed' : 'passed', executedPHP,
      agentsCommit: configuration?.pin.commit ?? null, catalogVersion: CATALOG.version, catalogDigest: CATALOG_SHA256,
      scope: 'Real Node/PHP grounded editorial laboratory, without a model, customer data or operational effects',
      results, directCli: cli, bridgeSummaries, fatal }, null, 2) + '\n');
    console.log(`R06 PHP interop: ${results.filter(result => result.status === 'pass').length}/${results.length} passed; executedPHP=${executedPHP}.`);
    if (fatal) console.error(`${fatal.phase}: ${fatal.check ?? fatal.code}: ${fatal.message}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
