import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { KNOWLEDGE } from '../ops/faisca/knowledge.mjs';
import { getActionCatalog } from '../ops/faisca/core.mjs';
import { createConversationResponse } from '../ops/faisca/conversation-contract.mjs';
import { AGENTS_POLICY_PATH } from '../ops/faisca/agents/protocol.mjs';
import { minimalProcessEnvironment } from '../ops/faisca/agents/php-provider.mjs';
import { CATALOG, CATALOG_JSON, CATALOG_SHA256 } from '../ops/faisca/grounding/catalog.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { prepareGroundedBridge } from '../ops/faisca/grounding/php-provider.mjs';
import { GROUNDED_ENTRYPOINT, GROUNDED_CATALOG_PATH, GROUNDED_REQUIRED_FILES,
  createGroundedRequest, validateGroundedRequest, parseGroundedOutput } from '../ops/faisca/grounding/protocol.mjs';

// A real Node child is deliberately injected below. These are transport and
// validation unit tests, never proof of PHP/Agents retrieval. R06 CI interop
// separately runs the pinned PHP executable without a substitute.
const execFileAsync = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const knowledgeDigest = sha256(await readFile(new URL('../ops/faisca/knowledge.mjs', import.meta.url)));
const policyPin = { knowledgeVersion: KNOWLEDGE.version, knowledgeDigest };
const request = () => ({ schema: 'faisca.conversation.v1', conversationId: 'synthetic_conversation_01',
  messageId: 'synthetic_message_01', locale: 'pt-BR', input: { type: 'action', id: 'goal_presence' } });
const candidateFor = req => createConversationResponse(req, getGroundedAnswer('goal_presence'));
const gitEnv = { ...minimalProcessEnvironment(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull };
const git = (root, args) => execFileAsync('git', ['-C', root, ...args], { env: gitEnv, encoding: 'utf8', timeout: 3000 });

// Independent fixture construction uses public catalog data, never a production
// result validator or the response finisher being tested.
function resultFixture(wire, catalog, pin) {
  const answer = catalog.answers.find(answer => answer.id === wire.grounding.answerId);
  const passages = answer.passageIds.map(id => ({ ...catalog.passages.find(passage => passage.id === id), trust: 'UNTRUSTED_DATA' }));
  const text = [answer.prefix, ...passages.map(passage => passage.title + ':\n' + passage.text), answer.suffix]
    .filter(Boolean).join('\n\n');
  const bindingDigest = createHash('sha256').update(JSON.stringify({ catalogVersion: catalog.version,
    catalogDigest: wire.grounding.catalogDigest, answerId: answer.id, candidateDigest: wire.candidateDigest,
    passageIds: answer.passageIds, passageDigests: passages.map(passage => passage.digest) })).digest('hex');
  return { schema: 'faisca.grounded.result.v1', execution: { schema: 'faisca.agents.result.v1',
    invocationId: wire.invocationId, requestFingerprint: wire.requestFingerprint, candidateDigest: wire.candidateDigest,
    conversationId: wire.conversationId, messageId: wire.messageId, locale: wire.locale,
    context: { scope: 'public_comercial', knowledgeVersion: pin.knowledgeVersion, knowledgeDigest: pin.knowledgeDigest },
    suggestion: { kind: 'SYNTHETIC_SUGGESTION', version: 'mock-v1', run: 'SYNTHETIC_' + wire.invocationId.toUpperCase(),
      source: 'SYNTHETIC_FAISCA_PUBLIC', text: 'SYNTHETIC summary proposal only' },
    evidence: { runState: 'CONCLUIDA', suggestions: 1, effects: 0, knowledgePassages: 1 }, operationalEffects: false },
  grounding: { catalogVersion: catalog.version, catalogDigest: wire.grounding.catalogDigest,
    answerId: answer.id, passageIds: answer.passageIds, passages, text, bindingDigest } };
}

const fixtureSource = `
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
${resultFixture.toString()}
const [mode, catalogPath, pinPath] = process.argv.slice(2);
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const pin = JSON.parse(await readFile(pinPath, 'utf8'));
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const wire = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const result = resultFixture(wire, catalog, pin);
if (mode === 'controlled') await new Promise(resolve => {
  const keepAlive = setInterval(() => {}, 1000);
  process.once('message', () => { clearInterval(keepAlive); resolve(); });
  process.stderr.write('SYNTHETIC_READY\\n');
});
if (mode === 'unrelated_passage') result.grounding.passages[0] = {
  ...catalog.passages.find(passage => passage.id === 'meta.approach'), trust: 'UNTRUSTED_DATA' };
if (mode === 'invented_text') result.grounding.text += '\\nResultado comercial garantido.';
if (mode === 'denied') {
  process.stdout.write(JSON.stringify({ schema: 'faisca.grounded.error.v1', code: 'grounding_denied' }) + '\\n');
  process.exitCode = 2;
} else process.stdout.write(JSON.stringify(result) + '\\n');
if (process.connected) process.disconnect();
`;

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r06-node-fixture-'));
  const policy = { schema: 'faisca.public-context.v1', scope: 'public_comercial', ...policyPin,
    sourceIds: Object.values(KNOWLEDGE.sources).map(source => source.id), actionIds: Object.keys(getActionCatalog()) };
  const files = {};
  for (const path of GROUNDED_REQUIRED_FILES) {
    const bytes = path === AGENTS_POLICY_PATH ? JSON.stringify(policy)
      : path === GROUNDED_CATALOG_PATH ? CATALOG_JSON : '<?php // SYNTHETIC NODE TRANSPORT FIXTURE ' + path + '\n';
    await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes);
    files[path] = sha256(bytes);
  }
  await git(root, ['init', '-q', '--initial-branch=fixture']);
  await git(root, ['add', '--', ...GROUNDED_REQUIRED_FILES]);
  await git(root, ['-c', 'user.name=Synthetic Fixture', '-c', 'user.email=synthetic@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + devNull, 'commit', '-q', '-m', 'Synthetic grounded transport']);
  const pin = { commit: (await git(root, ['rev-parse', 'HEAD'])).stdout.trim(), files, ...policyPin };
  const script = join(root, 'node-grounded-fixture.mjs'), pinPath = join(root, 'node-fixture-pin.json');
  await writeFile(script, fixtureSource); await writeFile(pinPath, JSON.stringify(pin));
  const bridges = new Set(), children = [], calls = [], frames = [];
  let ready = 0;
  t.after(async () => {
    await Promise.allSettled([...bridges].map(bridge => bridge.close()));
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await rm(root, { recursive: true, force: true });
  });
  const runner = mode => (binary, args, options) => {
    calls.push({ binary, args, options });
    const child = spawn(process.execPath, [script, mode, join(root, GROUNDED_CATALOG_PATH), pinPath],
      { ...options, stdio: [...options.stdio, 'ipc'] });
    children.push(child);
    const end = child.stdin.end.bind(child.stdin);
    child.stdin.end = (frame, ...rest) => { frames.push(Buffer.from(frame)); return end(frame, ...rest); };
    child.stderr.on('data', bytes => { if (bytes.toString().includes('SYNTHETIC_READY')) ready++; });
    return child;
  };
  const prepare = async (options = {}, factory = prepareGroundedBridge) => {
    const bridge = await factory({ enabled: '1', agentsRoot: root, pin, spawnProcess: runner('success'), ...options });
    bridges.add(bridge); return bridge;
  };
  return { root, pin, runner, prepare, calls, frames, children, ready: () => ready };
}

test('R06 binds the exact reviewed answer to independent UTF-8 golden digests, not just valid citation IDs', async () => {
  const req = request(), candidate = candidateFor(req);
  const wire = await createGroundedRequest(req, candidate, { ...policyPin, invocationId: 'ab'.repeat(16) });
  // Computed independently with Python compact UTF-8 JSON, also checked by PHP CI.
  assert.equal(wire.candidateDigest, 'b38ca2663b36834914d299c7bf00f9e4e9006ad9fe73e4e14ca9319a78b507a2');
  const result = resultFixture(wire, CATALOG, policyPin);
  assert.equal(result.grounding.bindingDigest, 'be0072c3c34244452888a56db09ce67c03fb2c911a9f98eacd2d653b8c5a66eb');
  const parse = value => parseGroundedOutput(Buffer.from(JSON.stringify(value) + '\n'), wire, policyPin);
  assert.equal(parse(result)?.kind, 'result');
  const unrelated = getGroundedAnswer('channel_meta');
  for (const invalid of [{ ...wire, candidateDigest: '0'.repeat(64) },
    { ...wire, grounding: { ...wire.grounding, passageIds: ['meta.approach'] } },
    { ...wire, grounding: { ...wire.grounding, answerId: unrelated.id, passageIds: unrelated.passageIds } },
    { ...wire, context: { scope: 'public_comercial' } }]) assert.equal(validateGroundedRequest(invalid, policyPin), null);
  await assert.rejects(createGroundedRequest(req, { ...candidate, text: candidate.text + '\nInventado.' },
    { ...policyPin, invocationId: 'ab'.repeat(16) }));
  for (const invalid of [
    { ...result, grounding: { ...result.grounding, bindingDigest: '0'.repeat(64) } },
    { ...result, execution: { ...result.execution, requestFingerprint: '0'.repeat(64) } },
    { ...result, grounding: { ...result.grounding, text: unrelated.text } },
    { ...result, grounding: { ...result.grounding, passages: result.grounding.passages.map(p => ({ ...p, trust: 'TRUSTED' })) } }
  ]) assert.equal(parse(invalid), null);
});

test('the R06 transport sends metadata with both lab flags and refuses invented text or unrelated authentic passages', async t => {
  const fx = await fixture(t), bridge = await fx.prepare();
  const req = { ...request(), input: { type: 'text', text: 'Quero avaliar um site para minha empresa sintética.' } };
  const candidate = candidateFor(req);
  assert.deepEqual(await bridge.createProvider().respond(req, { candidate }), candidate);
  const call = fx.calls[0], frame = fx.frames[0].toString('utf8'), wire = JSON.parse(frame);
  assert.equal(call.binary, 'php'); assert.equal(call.args.at(-1), join(fx.root, GROUNDED_ENTRYPOINT));
  assert.equal(call.options.shell, false);
  assert.deepEqual(call.options.env, { ...minimalProcessEnvironment(), IMAGINE_FAISCA_AGENTS_LAB: '1',
    IMAGINE_FAISCA_GROUNDED_LAB: '1', IMAGINE_FAISCA_AGENTS_SCENARIO: 'success', IMAGINE_FAISCA_AGENTS_DELAY_MS: '0' });
  assert.deepEqual(Object.keys(wire).sort(), ['schema', 'invocationId', 'requestFingerprint', 'candidateDigest',
    'conversationId', 'messageId', 'locale', 'grounding'].sort());
  assert.equal(frame, JSON.stringify(wire));
  assert.ok(!frame.includes(req.input.text)); assert.ok(!frame.includes(candidate.text));
  assert.deepEqual(wire.grounding, { catalogVersion: CATALOG.version, catalogDigest: CATALOG_SHA256,
    answerId: 'goal_presence', passageIds: getGroundedAnswer('goal_presence').passageIds });
  for (const mode of ['unrelated_passage', 'invented_text', 'denied']) {
    const negative = await fx.prepare({ spawnProcess: fx.runner(mode) });
    await assert.rejects(negative.createProvider().respond(req, { candidate }),
      { code: mode === 'denied' ? 'unavailable' : 'provider_unknown' }, mode);
    assert.equal(negative.inspect().spawned, 1); assert.equal(negative.inspect().completed, 0);
    assert.equal(negative.inspect().pending, 0); await negative.close();
  }
});

test('R06 rechecks the local catalog and each commercial source before dispatch and after the owned child finishes', async t => {
  const fx = await fixture(t), isolated = await mkdtemp(join(tmpdir(), 'faisca-r06-source-unit-'));
  t.after(() => rm(isolated, { recursive: true, force: true }));
  const sourcePaths = ['ops/faisca/grounding/catalog.json', ...Object.keys(CATALOG.sourceSnapshot.files)];
  const files = ['ops/faisca/core.mjs', 'ops/faisca/knowledge.mjs', 'ops/faisca/conversation-contract.mjs',
    'ops/faisca/agents/protocol.mjs', 'ops/faisca/agents/php-provider.mjs',
    'ops/faisca/grounding/catalog.mjs', 'ops/faisca/grounding/guide.mjs',
    'ops/faisca/grounding/protocol.mjs', 'ops/faisca/grounding/php-provider.mjs', ...sourcePaths];
  for (const path of files) {
    await mkdir(dirname(join(isolated, path)), { recursive: true });
    await copyFile(fileURLToPath(new URL('../' + path, import.meta.url)), join(isolated, path));
  }
  const { prepareGroundedBridge: prepareCopy } = await import(pathToFileURL(join(isolated, 'ops/faisca/grounding/php-provider.mjs')));
  const req = request(), candidate = candidateFor(req);
  for (const path of sourcePaths) {
    const target = join(isolated, path), original = await readFile(target);
    const before = await fx.prepare({}, prepareCopy), beforeCalls = fx.calls.length;
    await writeFile(target, Buffer.concat([original, Buffer.from('\n')]));
    await assert.rejects(before.createProvider().respond(req, { candidate }), { code: 'unavailable' }, path);
    assert.equal(fx.calls.length, beforeCalls, 'Changed local bytes must fail before starting a child.');
    await writeFile(target, original); await before.close();
    const after = await fx.prepare({ spawnProcess: fx.runner('controlled') }, prepareCopy), previousReady = fx.ready();
    const pending = after.createProvider().respond(req, { candidate });
    const rejection = assert.rejects(pending, { code: 'provider_unknown' }, path);
    const deadline = Date.now() + 4000;
    while (fx.ready() === previousReady) {
      assert.ok(Date.now() < deadline, 'The explicit Node transport fixture did not reach its checkpoint.');
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    await writeFile(target, Buffer.concat([original, Buffer.from('\n')]));
    fx.children.at(-1).send('release'); await rejection;
    assert.equal(after.inspect().spawned, 1); assert.equal(after.inspect().completed, 0);
    assert.equal(after.inspect().pending, 0);
    await writeFile(target, original); await after.close();
  }
});
