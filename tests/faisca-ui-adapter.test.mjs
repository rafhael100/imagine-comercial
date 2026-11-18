import test from 'node:test';
import assert from 'node:assert/strict';
import { bindLabHost } from '../ops/faisca/lab/lazy-host.mjs';

// EventTarget doubles exercise loading races only. Browser QA owns actual DOM,
// focus, layout, accessibility and the simulated conversation's end-to-end path.
function makeHost() {
  const start = Object.assign(new EventTarget(), { hidden: true, disabled: false });
  const scenario = Object.assign(new EventTarget(), { value: 'success' });
  const scenarioControl = { hidden: true };
  const feedback = { textContent: 'Static guidance' };
  const root = {};
  const elements = new Map([
    ['[data-faisca-root]', root], ['[data-faisca-lab-start]', start],
    ['[data-faisca-lab-status]', feedback], ['[data-faisca-lab-scenario]', scenario],
    ['[data-faisca-lab-scenarios]', scenarioControl]
  ]);
  return { host: { isConnected: true, querySelector: key => elements.get(key) ?? null },
    start, scenario, scenarioControl, feedback, root };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function select(view, value) {
  view.scenario.value = value;
  view.scenario.dispatchEvent(new Event('change'));
}

const controls = view => ({ hidden: view.start.hidden, disabled: view.start.disabled,
  text: view.feedback.textContent, scenariosHidden: view.scenarioControl.hidden });

for (const settlement of ['resolve', 'reject']) {
  test(`changing a scenario during import ignores the old ${settlement} after replacement activation`, async () => {
    const view = makeHost();
    const oldImport = deferred();
    const newImport = deferred();
    const calls = [];
    let loads = 0, destroys = 0;
    const binding = bindLabHost(view.host, () => (++loads === 1 ? oldImport.promise : newImport.promise));
    assert.equal(view.scenarioControl.hidden, false);
    const oldPending = binding.activate();
    select(view, 'timeout');
    assert.equal(view.start.disabled, false);
    assert.equal(view.start.hidden, false);
    const newPending = binding.activate();
    newImport.resolve({ mountFaisca(root, config) {
      calls.push({ root, config });
      return { open() {}, destroy() { destroys++; } };
    } });
    await newPending;
    const snapshot = controls(view);
    if (settlement === 'reject') oldImport.reject(new Error('Synthetic stale import rejection'));
    else oldImport.resolve({ mountFaisca() { throw new Error('Stale module must never mount'); } });
    await oldPending;
    assert.equal(loads, 2);
    assert.deepEqual(calls, [{ root: view.root, config: { scenario: 'timeout' } }]);
    assert.deepEqual(controls(view), snapshot);
    assert.equal(destroys, 0, 'stale completion cannot destroy the replacement');
    binding.destroy();
    assert.equal(destroys, 1);
    assert.equal(view.scenarioControl.hidden, true);
  });
}

test('old import completion cannot enable activation while the new scenario is still loading', async () => {
  const view = makeHost();
  const oldImport = deferred(), newImport = deferred();
  let loads = 0, mounts = 0;
  const binding = bindLabHost(view.host, () => (++loads === 1 ? oldImport.promise : newImport.promise));
  const oldPending = binding.activate();
  select(view, 'unavailable');
  const newPending = binding.activate();
  const snapshot = controls(view);
  oldImport.resolve({ mountFaisca() { mounts++; return { open() {}, destroy() {} }; } });
  await oldPending;
  assert.deepEqual(controls(view), snapshot);
  assert.equal(view.start.disabled, true);
  await binding.activate();
  assert.equal(loads, 2, 'an obsolete finally block cannot permit a duplicate import');
  newImport.resolve({ mountFaisca(root, config) {
    assert.equal(config.scenario, 'unavailable'); mounts++;
    return { open() {}, destroy() {} };
  } });
  await newPending;
  assert.equal(mounts, 1);
  binding.destroy();
});

test('switching an active scenario destroys exactly its instance and reactivates with the new allowlisted config', async () => {
  const view = makeHost();
  const configs = [], destroyed = [];
  const binding = bindLabHost(view.host, async () => ({ mountFaisca(root, config) {
    assert.equal(root, view.root);
    configs.push(config);
    return { open() {}, destroy() { destroyed.push(config.scenario); } };
  } }));
  await binding.activate();
  select(view, 'malformed');
  assert.deepEqual(destroyed, ['success']);
  assert.equal(view.start.hidden, false);
  assert.doesNotMatch(view.feedback.textContent, /Demonstração ativa/);
  await binding.activate();
  await binding.activate();
  assert.deepEqual(configs, [{ scenario: 'success' }, { scenario: 'malformed' }]);
  binding.destroy(); binding.destroy();
  assert.deepEqual(destroyed, ['success', 'malformed']);
  const snapshot = controls(view);
  select(view, 'limit');
  assert.deepEqual(controls(view), snapshot, 'removed scenario listener cannot change a destroyed host');
});

test('visitor-modified scenario values cannot select a provider or mount unreviewed configuration', async () => {
  const view = makeHost();
  const configs = [];
  const binding = bindLabHost(view.host, async () => ({ mountFaisca(root, config) {
    configs.push(config); return { open() {}, destroy() {} };
  } }));
  for (const value of ['https://provider.invalid', 'production', 'tenant_admin', '__proto__']) {
    select(view, value);
    await binding.activate();
    assert.deepEqual(configs, []);
    assert.equal(view.start.hidden, false);
    assert.equal(view.start.disabled, false);
    assert.match(view.feedback.textContent, /tentar novamente/);
  }
  select(view, 'limit');
  await binding.activate();
  assert.deepEqual(configs, [{ scenario: 'limit' }]);
  binding.destroy();
});
