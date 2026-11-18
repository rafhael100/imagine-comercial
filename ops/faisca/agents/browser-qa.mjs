import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startHttpLab } from '../server/http-lab.mjs';
import { prepareAgentsBridge } from './php-provider.mjs';
import { bridgeCounts, eventually, readAgentsQaConfiguration } from './check-interop.mjs';

// Real Chromium -> loopback HTTP -> pinned PHP Agents. Browser fault injection
// only drops or alters an actual HTTP response; it never substitutes PHP work.
const directory = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(directory, '../output/astro');
const reports = resolve(directory, '../reports');
const endpoints = { sessions: '/__faisca_lab/sessions', messages: '/__faisca_lab/messages',
  reconcile: '/__faisca_lab/reconcile', session: '/__faisca_lab/session' };
const assets = new Set(), results = [], unexpectedRequests = [], runtimeErrors = [], fixtures = [];
let browser, configuration, phase = 'preconditions', currentCheck, fatal, executedPHP = false, axeExecuted = false;

async function check(name, operation) {
  currentCheck = name;
  await operation();
  results.push({ name, status: 'pass' });
  console.log('PASS ' + name);
  currentCheck = undefined;
}

async function collect(directoryPath) {
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const path = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile()) assets.add('/' + relative(staticDir, path).split(sep).join('/'));
    else throw new Error('The laboratory build contains a non-regular artifact.');
  }
}

async function withServer(options, operation) {
  const bridge = await prepareAgentsBridge({ ...configuration, scenario: options.scenario ?? 'success',
    delayMs: options.delayMs ?? 0, processDeadlineMs: 3000 });
  let server, completed = false;
  const contexts = [], views = [];
  try {
    server = await startHttpLab({ enabled: '1', port: 0, staticDir, createProvider: bridge.createProvider,
      timeoutMs: options.timeoutMs ?? 250, sessionTtlMs: options.sessionTtlMs ?? 300000,
      ...(options.now ? { now: options.now } : {}) });
    async function open({ javaScriptEnabled = true, fault = null } = {}) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 1440, height: 1000 } });
      contexts.push(context);
      const requests = [], sessions = [], captures = [];
      let pendingFault = fault;
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        const staticRequest = method === 'GET' && (url.pathname === '/http/' || assets.has(url.pathname));
        const apiRequest = (method === 'POST' && [endpoints.sessions, endpoints.messages, endpoints.reconcile].includes(url.pathname)) ||
          (method === 'DELETE' && url.pathname === endpoints.session);
        if (url.origin !== server.origin || url.search || (!staticRequest && !apiRequest)) {
          unexpectedRequests.push({ method, path: url.pathname });
          await route.abort();
          return;
        }
        requests.push({ method, path: url.pathname });
        if (pendingFault === 'session_context' && url.pathname === endpoints.sessions) {
          pendingFault = null;
          const response = await route.fetch({ maxRedirects: 0 });
          const body = await response.json();
          body.context.scope = 'SYNTHETIC_UNREVIEWED_SCOPE';
          await route.fulfill({ response, body: JSON.stringify(body) });
          return;
        }
        if (['lost_response', 'response_version'].includes(pendingFault) && url.pathname === endpoints.messages) {
          const selectedFault = pendingFault;
          pendingFault = null;
          // Wait for actual Node/PHP completion before losing or corrupting only
          // the browser-facing transport response.
          const response = await route.fetch({ maxRedirects: 0 });
          if (selectedFault === 'lost_response') { await route.abort('failed'); return; }
          const body = await response.json();
          body.response.knowledgeVersion = 'SYNTHETIC_UNREVIEWED_VERSION';
          body.response.text = 'SYNTHETIC_UNREVIEWED_RESPONSE';
          await route.fulfill({ response, body: JSON.stringify(body) });
          return;
        }
        await route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', error => runtimeErrors.push({ message: error.message }));
      page.on('response', response => {
        if (new URL(response.url()).pathname === endpoints.sessions && response.ok()) {
          captures.push(response.json().then(session => { sessions.push(session); }).catch(() => {}));
        }
      });
      await page.goto(server.origin + '/http/', { waitUntil: 'load' });
      const view = { context, page, requests, sessions,
        root: page.locator('[data-faisca-root]'), start: page.locator('[data-faisca-http-start]'),
        reconcile: page.locator('[data-faisca-http-reconcile]'),
        reconciliation: page.locator('[data-faisca-http-reconciliation]'),
        async flush() { await Promise.all(captures); },
        apiCount(path) { return requests.filter(request => request.path === path).length; },
        async activate() {
          await view.start.waitFor({ state: 'visible' });
          await view.start.click();
          await page.locator('#faisca-composer').waitFor({ state: 'visible' });
        },
        async begin(text = 'Qual a diferença entre Onepage e Landing Page?') {
          await page.locator('#faisca-input').fill(text);
          await page.locator('#faisca-send').click();
        },
        async send(text) {
          const before = await page.locator('#faisca-log .assistant').count();
          await view.begin(text);
          await page.waitForFunction(previous => {
            const log = document.querySelector('#faisca-log');
            return log.getAttribute('aria-busy') === 'false' && log.querySelectorAll('.assistant').length === previous + 1;
          }, before);
          await view.flush();
        },
        async answer() { return page.locator('#faisca-log .assistant .message-body').last().innerText(); },
        async outcome(status, delivery) {
          assert.equal(await view.root.getAttribute('data-faisca-status'), status, 'Unexpected terminal UI status.');
          assert.equal(await view.root.getAttribute('data-faisca-delivery'), delivery, 'Unexpected terminal delivery mode.');
        }
      };
      views.push(view);
      return view;
    }
    await operation({ bridge, server, open });
    completed = true;
  } finally {
    try {
      if (completed) for (const view of views) {
        assert.deepEqual(await view.context.cookies(), [], 'The PHP laboratory cannot set browser cookies.');
        assert.deepEqual(await view.page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
          { local: 0, session: 0 }, 'The PHP laboratory must keep browser credentials and conversations volatile.');
        await view.flush();
        const html = await view.page.content();
        for (const session of view.sessions) {
          assert.ok(typeof session.token === 'string' && !html.includes(session.token), 'A session token cannot enter the DOM.');
        }
      }
    } finally {
      for (const context of contexts) await context.close();
      await server?.close();
      await bridge.close();
      await eventually(() => bridgeCounts(bridge).pending === 0, 'A fixture left a real PHP child pending.');
      if (server) await eventually(() => server.inspect().sockets === 0, 'A fixture left an HTTP socket registered.');
      const serverState = server?.inspect();
      fixtures.push({ scenario: options.scenario ?? 'success', bridge: bridgeCounts(bridge),
        server: serverState ? Object.fromEntries(['live', 'sessions', 'sockets', 'inflight', 'createdSessions',
          'expiredSessions', 'dispatched', 'messages', 'reconciliations'].map(name => [name, serverState[name]])) : null });
      if (server && completed) {
        assert.equal(serverState.live, false, 'Closing the fixture must stop its real HTTP server.');
        assert.equal(serverState.sessions, 0, 'Closing the fixture must release all volatile sessions.');
        assert.equal(serverState.inflight, 0, 'Closing the fixture must drain HTTP handlers.');
      }
    }
  }
}

async function waitUnknown(view, state = 'unknown') {
  await view.page.locator(`[data-faisca-http-state="${state}"]`).waitFor({ state: 'visible' });
  assert.equal(await view.page.locator('#faisca-log').getAttribute('aria-busy'), 'true', 'An unconfirmed turn must remain pending.');
  assert.equal(await view.page.locator('#faisca-send').isEnabled(), false, 'Unconfirmed work cannot allow a second message.');
  assert.equal(await view.reconcile.isEnabled(), true, 'Unknown work must expose manual consultation.');
}

async function reconcileAnswered(view) {
  await view.reconcile.click();
  await view.reconciliation.filter({ hasText: 'Resposta conciliada:' }).waitFor({ state: 'visible' });
  await view.page.waitForFunction(() => document.querySelector('#faisca-log').getAttribute('aria-busy') === 'false');
  await view.outcome('answered', 'simulated');
}

function completedPhp(bridge, expected = 1) {
  const counts = bridgeCounts(bridge);
  assert.equal(counts.spawned, expected, 'The path must execute exactly the expected number of real PHP children.');
  assert.equal(counts.completed, expected, 'The real PHP children must complete before the answer is accepted.');
  assert.equal(counts.pending, 0, 'Accepted PHP work must be fully drained.');
}

try {
  configuration = await readAgentsQaConfiguration();
  // Reject missing or wrong source pins before starting Chromium. The success
  // check below also requires PHP itself; this preparation is not execution.
  const verified = await prepareAgentsBridge(configuration);
  await verified.close();
  phase = 'read_build';
  await collect(staticDir);
  assert.deepEqual([...assets].filter(path => path.endsWith('.html')).sort(), ['/http/index.html', '/index.html'],
    'The existing isolated two-page laboratory must remain unchanged.');
  const deferredModules = [...assets].filter(path => /\/_astro\/http-ui\.[^/]+\.js$/.test(path));
  assert.equal(deferredModules.length, 1, 'The HTTP conversation must retain one deferred UI module.');
  assert.ok(!(await readFile(resolve(staticDir, 'http/index.html'), 'utf8')).includes('Bearer '), 'Static HTML cannot embed credentials.');
  phase = 'browser_launch';
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  phase = 'checks';

  await withServer({}, async ({ bridge, server, open }) => {
    const view = await open();
    await check('lazy activation, no-JavaScript content and sensitive input execute zero PHP processes', async () => {
      await view.start.waitFor({ state: 'visible' });
      assert.equal(await view.page.locator('#hero-title').isVisible(), true, 'Static guidance must remain readable.');
      assert.equal(await view.page.locator('#faisca-composer').isVisible(), false, 'The conversation must remain lazy.');
      assert.equal(view.requests.some(request => request.path === deferredModules[0]), false, 'The conversation module cannot load before activation.');
      await view.activate();
      assert.equal(view.requests.filter(request => request.path === deferredModules[0]).length, 1, 'Activation must load the UI once.');
      assert.equal(view.apiCount(endpoints.sessions), 0, 'Activation alone cannot create a session.');
      await view.send('Minha senha SYNTHETIC_EXAMPLE');
      assert.equal(view.requests.some(request => request.path.startsWith('/__faisca_lab/')), false, 'Sensitive input must stay in the local preflight.');
      assert.doesNotMatch(await view.page.locator('#faisca-log').innerText(), /SYNTHETIC_EXAMPLE/, 'Sensitive input cannot be echoed.');
      const noJs = await open({ javaScriptEnabled: false });
      assert.equal(await noJs.page.locator('#hero-title').isVisible(), true, 'No-JavaScript guidance must remain readable.');
      assert.equal(await noJs.page.locator('.no-script-note').isVisible(), true, 'No-JavaScript guidance must explain its mode.');
      assert.equal(await noJs.start.isVisible(), false, 'No-JavaScript markup cannot expose an unusable activation control.');
      assert.equal(noJs.requests.some(request => request.path.startsWith('/__faisca_lab/')), false, 'No-JavaScript rendering cannot open an API session.');
      assert.equal(server.inspect().createdSessions, 0, 'These preflight paths cannot create server sessions.');
      assert.equal(bridgeCounts(bridge).spawned, 0, 'These preflight paths cannot spawn PHP.');
    });
    await check('a real browser turn completes pinned PHP once and preserves responsive accessible controls', async () => {
      await view.send('Qual a diferença entre Onepage e Landing Page?');
      await view.outcome('answered', 'simulated');
      assert.match(await view.answer(), /Onepage/, 'The PHP receipt must release the reviewed editorial answer.');
      completedPhp(bridge);
      executedPHP = true;
      assert.equal(view.apiCount(endpoints.sessions), 1, 'The real conversation must create one volatile session.');
      assert.equal(view.apiCount(endpoints.messages), 1, 'The turn must make one HTTP message request.');
      assert.equal(server.inspect().dispatched, 1, 'The HTTP runtime must dispatch once.');
      for (const width of [320, 390, 1440]) {
        await view.page.setViewportSize({ width, height: 1000 });
        assert.equal(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `The PHP path must not overflow at ${width}px.`);
        const audit = await new AxeBuilder({ page: view.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.deepEqual(audit.violations, [], `The PHP path must pass axe at ${width}px.`);
      }
      axeExecuted = true;
    });
  });

  await check('early and late manual consultations keep one real PHP dispatch and advance the original turn once', async () => {
    await withServer({ scenario: 'delay', delayMs: 2000, timeoutMs: 75 }, async ({ bridge, server, open }) => {
      const view = await open(); await view.activate();
      const summary = await view.page.locator('#faisca-summary-text').inputValue();
      await view.begin('Quero organizar minhas vendas');
      await waitUnknown(view);
      assert.equal(bridgeCounts(bridge).completed, 0, 'The early consultation must precede actual PHP completion.');
      await view.reconcile.click();
      await waitUnknown(view);
      assert.equal(view.apiCount(endpoints.reconcile), 1, 'The early consultation must use the dedicated endpoint.');
      const pendingChat = await view.page.locator('#faisca-log').innerText();
      assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), summary, 'An unconfirmed PHP turn cannot advance the summary.');
      await eventually(() => bridgeCounts(bridge).completed === 1, 'The actual delayed PHP process did not complete.');
      assert.equal(await view.page.locator('#faisca-log').innerText(), pendingChat, 'Late PHP completion cannot insert itself into the chat.');
      await reconcileAnswered(view);
      assert.match(await view.answer(), /Imagine CRM/, 'The final consultation must deliver the original candidate.');
      assert.match(await view.page.locator('#faisca-summary-text').inputValue(), /Imagine CRM/, 'The confirmed original turn must advance the summary once.');
      assert.equal(await view.page.locator('#faisca-log .assistant').count(), 2, 'The original turn must produce only one final answer.');
      assert.equal(view.apiCount(endpoints.messages), 1, 'Consultation cannot send a second message.');
      assert.equal(view.apiCount(endpoints.reconcile), 2, 'Both consultations must use the same reconciliation path.');
      assert.equal(server.inspect().dispatched, 1, 'Neither consultation may redispatch the runtime.');
      completedPhp(bridge);
    });
  });

  await check('loss of an actual completed PHP HTTP response reconciles without another spawn', async () => {
    await withServer({}, async ({ bridge, server, open }) => {
      const view = await open({ fault: 'lost_response' }); await view.activate();
      const summary = await view.page.locator('#faisca-summary-text').inputValue();
      await view.begin();
      await waitUnknown(view, 'transport_unknown');
      completedPhp(bridge);
      assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), summary, 'Transport loss cannot advance the summary.');
      await reconcileAnswered(view);
      assert.match(await view.answer(), /Onepage/, 'Reconciliation must recover the actual completed PHP turn.');
      assert.equal(view.apiCount(endpoints.messages), 1, 'Response loss cannot resend the message.');
      assert.equal(view.apiCount(endpoints.reconcile), 1, 'Recovery must use one explicit consultation.');
      assert.equal(server.inspect().dispatched, 1, 'Recovery cannot redispatch the provider.');
      completedPhp(bridge);
    });
  });

  await check('reset, component removal and session expiry discard pending PHP work and drain children', async () => {
    for (const lifecycle of ['reset', 'disconnect', 'ttl']) {
      let clock = 1000;
      await withServer({ scenario: 'delay', delayMs: 2000, timeoutMs: 200,
        ...(lifecycle === 'ttl' ? { sessionTtlMs: 1000, now: () => clock } : {}) }, async ({ bridge, server, open }) => {
        const view = await open(); await view.activate();
        await view.begin('Quero organizar minhas vendas');
        await eventually(() => bridgeCounts(bridge).spawned === 1, 'The lifecycle fixture must actually start PHP.');
        if (lifecycle === 'reset') await view.page.locator('#faisca-reset').click();
        else if (lifecycle === 'disconnect') {
          await view.page.evaluate(() => {
            const host = document.querySelector('faisca-http-lab');
            const parent = host.parentElement;
            host.remove(); parent.append(host);
          });
          await view.start.waitFor({ state: 'visible' });
          await view.activate();
        } else {
          // Advance only the trusted server clock after actual dispatch. This
          // tests delivery-time expiry without timing a browser against a TTL.
          clock += 1001;
          await view.page.locator('[data-faisca-http-state="closed"]').waitFor({ state: 'visible' });
          await view.page.waitForFunction(() => document.querySelector('#faisca-log').getAttribute('aria-busy') === 'false');
          await view.outcome('closed', 'none');
          assert.equal(server.inspect().expiredSessions, 1, 'The actual session must expire before delivery.');
        }
        await eventually(() => server.inspect().sessions === 0, 'Lifecycle cleanup must dispose the server session.');
        await eventually(() => bridgeCounts(bridge).pending === 0, 'Lifecycle cleanup must drain the actual PHP child.');
        await eventually(() => server.inspect().inflight === 0, 'Lifecycle cleanup must finish pending HTTP handlers.');
        const snapshot = await view.page.locator('#faisca-log').innerText();
        await view.page.waitForTimeout(75);
        assert.equal(await view.page.locator('#faisca-log').innerText(), snapshot, 'Old PHP callbacks cannot reenter the chat.');
        assert.doesNotMatch(await view.page.locator('#faisca-summary-text').inputValue(), /Imagine CRM/, 'Discarded work cannot advance the summary.');
        assert.equal(await view.reconcile.isEnabled(), false, 'Disposed work cannot remain reconcilable in the UI.');
        assert.equal(server.inspect().dispatched, 1, 'Lifecycle cleanup cannot redispatch.');
        assert.equal(bridgeCounts(bridge).spawned, 1, 'Lifecycle cleanup cannot spawn a replacement process.');
      });
    }
  });

  await check('actual PHP unavailability and mock context revocation produce explicit local fallback', async () => {
    for (const scenario of ['unavailable', 'revoke_before_delivery']) {
      await withServer({ scenario }, async ({ bridge, server, open }) => {
        const view = await open(); await view.activate();
        await view.send('Qual a diferença entre Onepage e Landing Page?');
        await view.outcome('unavailable', 'guided_fallback');
        assert.match(await view.answer(), /indisponível/i, 'An actual PHP refusal must be stated honestly.');
        assert.match(await view.answer(), /Onepage/, 'The fallback remains the local reviewed guide.');
        assert.equal(bridgeCounts(bridge).spawned, 1, 'This negative case must execute real PHP.');
        assert.equal(bridgeCounts(bridge).pending, 0, 'The refusing PHP process must be drained.');
        assert.equal(server.inspect().dispatched, 1, 'The explicit refusal must not trigger a retry.');
        assert.equal(await view.reconcile.isEnabled(), false, 'A known refusal does not need uncertain-work reconciliation.');
      });
    }
  });

  await check('the browser rejects a tampered HTTP context and a tampered version after actual PHP completion', async () => {
    await withServer({}, async ({ bridge, server, open }) => {
      const view = await open({ fault: 'session_context' }); await view.activate();
      await view.send('Qual a diferença entre Onepage e Landing Page?');
      await view.outcome('unavailable', 'none');
      assert.equal(server.inspect().createdSessions, 1, 'The tampering fixture must alter an actual server session response.');
      assert.equal(view.apiCount(endpoints.messages), 0, 'An invalid session context must stop before message dispatch.');
      assert.equal(bridgeCounts(bridge).spawned, 0, 'Invalid session context cannot reach PHP.');
      assert.doesNotMatch(await view.page.locator('#faisca-log').innerText(), /SYNTHETIC_UNREVIEWED/, 'Untrusted context cannot be rendered.');
    });
    await withServer({}, async ({ bridge, server, open }) => {
      const view = await open({ fault: 'response_version' }); await view.activate();
      const summary = await view.page.locator('#faisca-summary-text').inputValue();
      await view.begin();
      await waitUnknown(view, 'transport_unknown');
      completedPhp(bridge);
      assert.doesNotMatch(await view.page.locator('#faisca-log').innerText(), /SYNTHETIC_UNREVIEWED/, 'A response with an unreviewed version cannot reach the DOM.');
      assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), summary, 'Invalid response data cannot advance the summary.');
      await reconcileAnswered(view);
      assert.match(await view.answer(), /Onepage/, 'A later valid consultation must recover the actual original PHP result.');
      assert.equal(server.inspect().dispatched, 1, 'Rejecting a corrupted response must not redispatch.');
      completedPhp(bridge);
    });
  });

  await check('all PHP browser cases use only the local allowlist and have no runtime errors', async () => {
    assert.deepEqual(unexpectedRequests, [], 'The integration cannot make unexpected browser requests.');
    assert.deepEqual(runtimeErrors, [], 'The integration cannot leave browser runtime errors.');
    assert.equal(executedPHP, true, 'Passing this suite requires observed real PHP completion.');
  });
} catch (error) {
  fatal = { phase, check: currentCheck ?? null, code: error?.code ?? 'qa_failure', message: error.message };
  if (currentCheck) results.push({ name: currentCheck, status: 'fail' });
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mkdir(reports, { recursive: true });
  await writeFile(resolve(reports, 'Faisca_AGENTS_R05_BROWSER_QA.json'), JSON.stringify({
    status: fatal ? 'failed' : 'passed', executedPHP, phase,
    browser: phase === 'checks' ? 'EXECUTED' : 'NOT_RUN', axe: axeExecuted ? 'EXECUTED' : 'NOT_RUN',
    agentsCommit: configuration?.pin.commit ?? null, knowledgeVersion: configuration?.pin.knowledgeVersion ?? null,
    knowledgeDigest: configuration?.pin.knowledgeDigest ?? null,
    scope: 'Synthetic real browser to loopback HTTP to pinned PHP Agents; no external model or operational authority',
    results, unexpectedRequests, runtimeErrors, fixtures, fatal
  }, null, 2) + '\n');
  console.log(`R05 PHP browser: ${results.filter(result => result.status === 'pass').length}/${results.length} passed; executedPHP=${executedPHP}.`);
  if (fatal) console.error(`${fatal.phase}: ${fatal.check ?? fatal.code}: ${fatal.message}`);
}
