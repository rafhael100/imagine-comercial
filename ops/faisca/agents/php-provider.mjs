import { spawn, execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { devNull } from 'node:os';
import { isAbsolute, join, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { KNOWLEDGE } from '../knowledge.mjs';
import { validateConversationRequest, validateConversationResponse } from '../conversation-contract.mjs';
import { AGENTS_ENTRYPOINT, AGENTS_POLICY_PATH, AGENTS_MAX_BYTES, AGENTS_REQUIRED_FILES,
  createAgentsRequest, parseAgentsOutput, validatePublicContext } from './protocol.mjs';

const execFileAsync = promisify(execFile);
const knowledgePath = fileURLToPath(new URL('../knowledge.mjs', import.meta.url));
const agentsContract = Object.freeze({
  entrypoint: AGENTS_ENTRYPOINT, requiredFiles: AGENTS_REQUIRED_FILES,
  scenarios: Object.freeze(['success', 'delay', 'unavailable', 'malformed', 'exit_after_dispatch', 'revoke_before_delivery']),
  environment: Object.freeze({}), createRequest: createAgentsRequest,
  parseOutput: parseAgentsOutput, finish: (_result, candidate) => candidate,
  verifyExtra: async () => {}
});
const sha256 = value => createHash('sha256').update(value).digest('hex');

// Windows needs its installed executable search path and SystemRoot. Select
// those OS values explicitly; never spread the host environment into a child.
export function minimalProcessEnvironment(platform = process.platform, environment = process.env) {
  if (platform !== 'win32') return Object.freeze({ PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' });
  const read = key => Object.entries(environment).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
  const systemRoot = read('SystemRoot') || 'C:\\Windows';
  return Object.freeze({ PATH: read('PATH') || systemRoot + '\\System32', SystemRoot: systemRoot, LANG: 'C', LC_ALL: 'C' });
}
const minimalEnv = minimalProcessEnvironment();
const gitEnv = Object.freeze({ ...minimalEnv, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull, GIT_OPTIONAL_LOCKS: '0' });

class AgentsBridgeError extends Error {
  constructor(code) {
    super('Synthetic Agents bridge refused the operation.');
    this.name = 'AgentsBridgeError';
    Object.defineProperty(this, 'code', { value: code, enumerable: true });
  }
}
const failure = code => new AgentsBridgeError(code);

function readPin(value, requiredFiles) {
  try {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = ['commit', 'files', 'knowledgeVersion', 'knowledgeDigest'];
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || own.some(key => !keys.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.some(key => !Object.hasOwn(descriptors[key], 'value'))) return null;
    const pin = Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
    if (typeof pin.commit !== 'string' || !/^[a-f0-9]{40}$/.test(pin.commit) ||
        pin.knowledgeVersion !== KNOWLEDGE.version || typeof pin.knowledgeDigest !== 'string' ||
        !/^[a-f0-9]{64}$/.test(pin.knowledgeDigest) || !pin.files || typeof pin.files !== 'object' ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(pin.files))) return null;
    const names = Reflect.ownKeys(pin.files);
    if (names.length < requiredFiles.length || names.length > 64) return null;
    const files = {};
    const fileDescriptors = Object.getOwnPropertyDescriptors(pin.files);
    for (const path of names) {
      if (typeof path !== 'string' || path.length > 200 ||
          !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:php|json)$/.test(path) ||
          !Object.hasOwn(fileDescriptors[path], 'value')) return null;
      const digest = fileDescriptors[path].value;
      if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) return null;
      files[path] = digest;
    }
    if (requiredFiles.some(path => !Object.hasOwn(files, path))) return null;
    return Object.freeze({ ...pin, files: Object.freeze(files) });
  } catch { return null; }
}

async function directPath(path) {
  const root = parse(path).root;
  let current = root;
  for (const component of path.slice(root.length).split(sep)) {
    if (!component) continue;
    current = join(current, component);
    if ((await lstat(current)).isSymbolicLink()) throw failure('pin_mismatch');
  }
  const actual = await realpath(path);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalize(actual) !== normalize(path)) throw failure('pin_mismatch');
}

async function readPinnedFile(path, maxBytes) {
  // O_NOFOLLOW is unavailable on Windows. lstat of every path component also
  // rejects Windows links/junctions; case alone is not evidence of a link.
  await directPath(path);
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw failure('pin_mismatch');
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const chunk = await handle.read(bytes, length, bytes.length - length, length);
      if (!chunk.bytesRead) break;
      length += chunk.bytesRead;
    }
    if (length !== stat.size) throw failure('pin_mismatch');
    return bytes.subarray(0, length);
  } finally { await handle.close(); }
}

async function verifyPin(root, pin, contract) {
  try {
    await directPath(root);
    if (!(await lstat(root)).isDirectory()) throw failure('pin_mismatch');
    const head = async () => (await execFileAsync('git', ['-c', 'core.fsmonitor=false', '-C', root,
      'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', timeout: 2000, maxBuffer: 1024, env: gitEnv })).stdout.trim();
    if (await head() !== pin.commit || sha256(await readPinnedFile(knowledgePath, 1024 * 1024)) !== pin.knowledgeDigest) {
      throw failure('pin_mismatch');
    }
    let total = 0;
    let policy;
    for (const [path, digest] of Object.entries(pin.files)) {
      const bytes = await readPinnedFile(join(root, path), path === AGENTS_POLICY_PATH ? AGENTS_MAX_BYTES : 1024 * 1024);
      total += bytes.length;
      if (total > 4 * 1024 * 1024 || sha256(bytes) !== digest) throw failure('pin_mismatch');
      if (path === AGENTS_POLICY_PATH) policy = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
    if (!validatePublicContext(policy, pin)) throw failure('pin_mismatch');
    await contract.verifyExtra({ agentsRoot: root, pin, readPinnedFile });
    if (await head() !== pin.commit) throw failure('pin_mismatch');
  } catch { throw failure('pin_mismatch'); }
}

/**
 * One owned PHP process per runtime dispatch. The injected spawnProcess is an
 * internal test seam; HTTP requests never choose an executable, environment,
 * checkout, scenario or process runner. There is no second retry ledger here.
 */
export function prepareAgentsBridge(options = {}) {
  return preparePinnedProcessBridge(options, agentsContract);
}

// Internal host-code composition only. Each public bridge fixes this contract
// in its own module; neither HTTP data nor bridge options select a contract.
// R05 still requires its original 19 pins, policy, knowledge and closed wire.
export async function preparePinnedProcessBridge({ enabled, agentsRoot, pin: pinValue, phpBinary = 'php',
  scenario = 'success', delayMs = 0, processDeadlineMs = 3000, spawnProcess = spawn } = {}, contract) {
  if (enabled !== '1') throw failure('lab_disabled');
  if (typeof agentsRoot !== 'string' || !isAbsolute(agentsRoot) || agentsRoot.includes('\0') ||
      typeof phpBinary !== 'string' || (phpBinary !== 'php' && !isAbsolute(phpBinary)) || phpBinary.includes('\0') ||
      !contract?.scenarios?.includes(scenario) || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 2000 ||
      !Number.isInteger(processDeadlineMs) || processDeadlineMs < 1 || processDeadlineMs > 10000 ||
      typeof spawnProcess !== 'function') throw failure('invalid_config');
  const root = resolve(agentsRoot);
  const requiredFiles = [...new Set([...AGENTS_REQUIRED_FILES, ...contract.requiredFiles])];
  const pin = readPin(pinValue, requiredFiles);
  if (!pin) throw failure('pin_mismatch');
  await verifyPin(root, pin, contract);

  const args = Object.freeze(['-n', '-d', 'display_errors=stderr', '-d', 'log_errors=0',
    '-d', 'allow_url_fopen=0', '-f', join(root, contract.entrypoint)]);
  const env = Object.freeze({ ...minimalEnv, IMAGINE_FAISCA_AGENTS_LAB: '1',
    IMAGINE_FAISCA_AGENTS_SCENARIO: scenario, IMAGINE_FAISCA_AGENTS_DELAY_MS: String(delayMs),
    ...contract.environment });
  const counts = { spawned: 0, completed: 0, failed: 0, pending: 0, rejectedBeforeSpawn: 0 };
  const providers = new Set();
  const operations = new Set();
  let live = true;
  let closing;

  function runProcess(owner, frame, state) {
    return new Promise((resolveRun, rejectRun) => {
      let child;
      let stopped = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let chunks = [];
      let timer;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        chunks = [];
        try { child.kill('SIGKILL'); } catch { /* Only this invocation's process is addressed. */ }
      };
      try {
        child = spawnProcess(phpBinary, [...args], { cwd: root, env: { ...env },
          shell: false, detached: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch { rejectRun(failure('unavailable')); return; }
      owner.children.add(stop);
      timer = setTimeout(stop, processDeadlineMs);
      child.once('spawn', () => {
        state.started = true;
        counts.spawned++;
        counts.pending++;
        if (!live || !owner.live || stopped) { stop(); return; }
        child.stdin.end(frame);
      });
      child.on('error', () => { if (state.started) stop(); });
      child.stdin.on('error', () => { if (state.started) stop(); });
      child.stdout.on('error', stop);
      child.stderr.on('error', stop);
      child.stdout.on('data', bytes => {
        if (stopped) return;
        stdoutBytes += bytes.length;
        if (stdoutBytes > AGENTS_MAX_BYTES) { stop(); return; }
        chunks.push(bytes);
      });
      // Diagnostics are counted and discarded, never retained or shown to the visitor.
      child.stderr.on('data', bytes => {
        stderrBytes += bytes.length;
        if (stderrBytes > 4096) stop();
      });
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        owner.children.delete(stop);
        if (!state.started) { rejectRun(failure('unavailable')); return; }
        if (stopped || signal || !live || !owner.live) { rejectRun(failure('provider_unknown')); return; }
        resolveRun({ code, bytes: Buffer.concat(chunks, stdoutBytes) });
      });
    });
  }

  function dispose(owner) {
    if (!owner.live) return owner.closing;
    owner.live = false;
    providers.delete(owner);
    for (const stop of owner.children) stop();
    owner.closing = Promise.allSettled([...owner.operations]).then(() => undefined);
    return owner.closing;
  }

  function createProvider() {
    if (!live) throw failure('unavailable');
    const owner = { live: true, children: new Set(), operations: new Set(), closing: null };
    providers.add(owner);
    function respond(value, options) {
      const state = { started: false };
      const work = (async () => {
        try {
          if (!live || !owner.live) throw failure('unavailable');
          const request = validateConversationRequest(value);
          const descriptor = options && Object.getOwnPropertyDescriptor(options, 'candidate');
          const candidate = request && descriptor && Object.hasOwn(descriptor, 'value') &&
            validateConversationResponse(descriptor.value, request);
          if (!candidate) throw failure('unavailable');
          const wire = await contract.createRequest(request, candidate, { invocationId: randomBytes(16).toString('hex'),
            knowledgeVersion: pin.knowledgeVersion, knowledgeDigest: pin.knowledgeDigest });
          const frame = Buffer.from(JSON.stringify(wire), 'utf8');
          if (frame.length > AGENTS_MAX_BYTES) throw failure('unavailable');
          await verifyPin(root, pin, contract);
          if (!live || !owner.live) throw failure('unavailable');
          const result = await runProcess(owner, frame, state);
          const output = contract.parseOutput(result.bytes, wire, pin);
          if (!output || (result.code !== 0 && result.code !== 2) ||
              (result.code === 0) !== (output.kind === 'result')) throw failure('provider_unknown');
          await verifyPin(root, pin, contract);
          if (!live || !owner.live) throw failure('provider_unknown');
          if (output.kind === 'error') throw failure('unavailable');
          const response = contract.finish(output.value, candidate, request, wire);
          counts.completed++;
          return response;
        } catch (error) {
          if (state.started) counts.failed++;
          else counts.rejectedBeforeSpawn++;
          // All native errors/paths/diagnostics stay inside the boundary. Only
          // a declared, validated PHP refusal is a known post-spawn failure.
          const known = error instanceof AgentsBridgeError && error.code === 'unavailable';
          throw failure(state.started && !known ? 'provider_unknown' : 'unavailable');
        } finally { if (state.started) counts.pending--; }
      })();
      operations.add(work);
      owner.operations.add(work);
      const forget = () => { operations.delete(work); owner.operations.delete(work); };
      work.then(forget, forget);
      return work;
    }
    return Object.freeze({ kind: 'simulated', respond, dispose: () => dispose(owner) });
  }

  function close() {
    if (closing) return closing;
    live = false;
    for (const owner of [...providers]) dispose(owner);
    closing = Promise.allSettled([...operations]).then(() => undefined);
    return closing;
  }

  return Object.freeze({ createProvider, inspect: () => Object.freeze({ ...counts }), close });
}
