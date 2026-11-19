import test from 'node:test';
import assert from 'node:assert/strict';
import { bindLabHost } from '../ops/faisca/lab/lazy-host.mjs';
import { mountFaisca } from '../ops/faisca/ui.mjs';

// Contract doubles for the lazy host, not a browser/DOM/accessibility simulation.
// Actual DOM, focus, layout and UI lifecycle remain in ops/faisca/browser-qa.mjs.
function makeHost() {
  const start = Object.assign(new EventTarget(), { hidden: true, disabled: false });
  const feedback = { textContent: 'Static guidance' };
  const root = { role: 'synthetic-conversation-root' };
  const elements = new Map([
    ['[data-faisca-root]', root],
    ['[data-faisca-lab-start]', start],
    ['[data-faisca-lab-status]', feedback]
  ]);
  const host = { isConnected: true, querySelector: selector => elements.get(selector) || null };
  return { host, start, feedback, root };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('conversation and lazy-host modules import without a browser or a page side effect', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof mountFaisca, 'function');
  assert.equal(typeof bindLabHost, 'function');
});

test('lazy activation performs no import until requested and coalesces duplicate activation', async () => {
  const view = makeHost();
  const loading = deferred();
  let imports = 0, mounts = 0, opens = 0, destroys = 0;
  const loader = () => { imports++; return loading.promise; };
  const binding = bindLabHost(view.host, loader);
  assert.equal(imports, 0);
  assert.equal(bindLabHost(view.host, loader), binding);
  assert.equal(view.start.hidden, false);
  const pending = binding.activate();
  await binding.activate();
  view.start.dispatchEvent(new Event('click'));
  assert.equal(imports, 1);
  assert.equal(view.start.disabled, true);
  loading.resolve({ mountFaisca(root) {
    assert.equal(root, view.root); mounts++;
    return { open() { opens++; }, destroy() { destroys++; } };
  }});
  await pending;
  await binding.activate();
  assert.deepEqual({ imports, mounts, opens }, { imports: 1, mounts: 1, opens: 1 });
  assert.equal(view.start.hidden, true);
  assert.equal(view.start.disabled, false);
  assert.match(view.feedback.textContent, /Demonstração ativa/);
  binding.destroy(); binding.destroy();
  view.start.dispatchEvent(new Event('click'));
  assert.equal(destroys, 1);
  assert.equal(imports, 1);
});

test('destroy invalidates a delayed import without creating an abandoned conversation', async () => {
  const view = makeHost();
  const loading = deferred();
  let mounts = 0;
  const binding = bindLabHost(view.host, () => loading.promise);
  const pending = binding.activate();
  binding.destroy();
  const snapshot = { ...view.start, text: view.feedback.textContent };
  loading.resolve({ mountFaisca() { mounts++; return { open() {}, destroy() {} }; } });
  await pending;
  assert.equal(mounts, 0);
  assert.deepEqual({ ...view.start, text: view.feedback.textContent }, snapshot);
});

test('a disconnected host refuses to mount a module that finished loading', async () => {
  const view = makeHost();
  const loading = deferred();
  let mounts = 0;
  const binding = bindLabHost(view.host, () => loading.promise);
  const pending = binding.activate();
  view.host.isConnected = false;
  loading.resolve({ mountFaisca() { mounts++; return { open() {}, destroy() {} }; } });
  await pending;
  assert.equal(mounts, 0);
  assert.equal(view.start.disabled, false);
  binding.destroy();
});

test('late failure from an old binding cannot overwrite a newly activated host', async () => {
  const view = makeHost();
  const oldLoading = deferred();
  const old = bindLabHost(view.host, () => oldLoading.promise);
  const pending = old.activate();
  old.destroy();
  let mounts = 0;
  const replacement = bindLabHost(view.host, async () => ({
    mountFaisca() { mounts++; return { open() {}, destroy() {} }; }
  }));
  assert.notEqual(replacement, old);
  await replacement.activate();
  const snapshot = { hidden: view.start.hidden, disabled: view.start.disabled, text: view.feedback.textContent };
  oldLoading.reject(new Error('Synthetic stale import failure'));
  await pending;
  assert.equal(mounts, 1);
  assert.deepEqual({ hidden: view.start.hidden, disabled: view.start.disabled, text: view.feedback.textContent }, snapshot);
  replacement.destroy();
});

test('a failed import is retryable and does not claim an active conversation', async () => {
  const view = makeHost();
  let imports = 0;
  const binding = bindLabHost(view.host, async () => {
    if (++imports === 1) throw new Error('Synthetic unavailable chunk');
    return { mountFaisca() { return { open() {}, destroy() {} }; } };
  });
  await binding.activate();
  assert.equal(view.start.hidden, false);
  assert.equal(view.start.disabled, false);
  assert.match(view.feedback.textContent, /tentar novamente/);
  await binding.activate();
  assert.equal(imports, 2);
  assert.match(view.feedback.textContent, /Demonstração ativa/);
  binding.destroy();
});

test('failed opening releases a partial instance and keeps the advertised retry reachable', async () => {
  const view = makeHost();
  let imports = 0, destroys = 0;
  const binding = bindLabHost(view.host, async () => {
    const attempt = ++imports;
    return { mountFaisca() { return {
      open() { if (attempt === 1) throw new Error('Synthetic open failure'); },
      destroy() { destroys++; }
    }; } };
  });
  await binding.activate();
  assert.equal(view.start.hidden, false, 'retry button remains reachable');
  assert.equal(view.start.disabled, false);
  assert.equal(destroys, 1, 'partial instance is released');
  assert.match(view.feedback.textContent, /tentar novamente/);
  await binding.activate();
  assert.equal(imports, 2, 'the partial instance cannot block retry');
  assert.match(view.feedback.textContent, /Demonstração ativa/);
  binding.destroy();
  assert.equal(destroys, 2);
});

test('malformed loaded modules fail locally while leaving retry available', async () => {
  for (const result of [undefined, {}, { mountFaisca: true }, { mountFaisca: () => undefined }, { mountFaisca: () => ({}) }]) {
    const view = makeHost();
    const binding = bindLabHost(view.host, async () => result);
    await binding.activate();
    assert.equal(view.start.hidden, false);
    assert.equal(view.start.disabled, false);
    assert.match(view.feedback.textContent, /tentar novamente/);
    assert.doesNotMatch(view.feedback.textContent, /Demonstração ativa/);
    assert.doesNotThrow(() => binding.destroy());
  }
});
