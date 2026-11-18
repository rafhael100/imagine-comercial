import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startHttpLab } from '../server/http-lab.mjs';
import { prepareGroundedBridge } from './php-provider.mjs';
import { groundedRespond, getGroundedAnswer } from './guide.mjs';
import { CATALOG, CATALOG_SHA256 } from './catalog.mjs';
import { createConversationOutcome } from '../conversation-runtime.mjs';
import { createHttpResult } from '../http-contract.mjs';
import { bridgeCounts, eventually, readGroundedQaConfiguration } from './check-interop.mjs';

// Real Chromium -> loopback HTTP -> pinned PHP + literal commercial passages. Browser fault injection
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
  const bridge = await prepareGroundedBridge({ ...configuration, scenario: options.scenario ?? 'success',
    delayMs: options.delayMs ?? 0, processDeadlineMs: 3000 });
  let server, completed = false;
  const contexts = [], views = [];
  try {
    server = await startHttpLab({ enabled: '1', port: 0, staticDir, createProvider: bridge.createProvider, prepareTurn: groundedRespond,
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
        const staticRequest = method === 'GET' && (url.pathname === '/grounded/' || assets.has(url.pathname));
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
        if (['wrong_topic', 'unsupported_claim'].includes(pendingFault) && url.pathname === endpoints.messages) {
          const selectedFault = pendingFault;
          pendingFault = null;
          // Wait for actual Node/PHP completion before losing or corrupting only
          // the browser-facing transport response.
          const response = await route.fetch({ maxRedirects: 0 });
          let body = await response.json();
          if (selectedFault === 'wrong_topic') {
            const actualRequest = request.postDataJSON();
            body = createHttpResult(actualRequest, createConversationOutcome('answered', {
              reply: getGroundedAnswer('channel_meta'), accepted: true, delivery: 'simulated' }));
          } else body.response.text += '\nA entrega está garantida para amanhã.';
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
      await page.goto(server.origin + '/grounded/', { waitUntil: 'load' });
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
        async begin(text = 'Quero um site para apresentar minha empresa') {
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
  configuration = await readGroundedQaConfiguration();
  // Reject missing or wrong source pins before starting Chromium. The success
  // check below also requires PHP itself; this preparation is not execution.
  const verified = await prepareGroundedBridge(configuration);
  await verified.close();
  phase = 'read_build';
  await collect(staticDir);
  assert.deepEqual([...assets].filter(path => path.endsWith('.html')).sort(), ['/grounded/index.html', '/http/index.html', '/index.html', '/journey/index.html', '/journey-http/index.html'],
    'The isolated laboratory contains the four reviewed R03/R04/R06/R07 pages.');
  const deferredModules = [...assets].filter(path => /\/_astro\/grounded-ui\.[^/]+\.js$/.test(path));
  assert.equal(deferredModules.length, 1, 'The grounded conversation must have one deferred UI module.');
  assert.ok(!(await readFile(resolve(staticDir, 'grounded/index.html'), 'utf8')).includes('Bearer '), 'Static HTML cannot embed credentials.');
  phase = 'browser_launch';
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  phase = 'checks';


  async function assertPassages(view, answerId, { prefix = false } = {}) {
    const answer = getGroundedAnswer(answerId);
    const actual = await view.answer();
    if (prefix) assert.ok(actual.endsWith(answer.text), 'Fallback must preserve the exact reviewed passage answer.');
    else assert.equal(actual, answer.text, 'The browser must render the exact PHP-grounded answer.');
    const message = view.page.locator('#faisca-log .assistant').last();
    const details = message.locator('details.message-sources');
    assert.equal(await details.count(), 1, 'Each supported answer must expose its provenance.');
    await details.locator('summary').click();
    assert.deepEqual(await details.locator('li').allTextContents(), answer.sources.map(source => source.title),
      'Provenance must expose the exact reviewed title, source snapshot and literal passage.');
    for (const id of answer.passageIds) {
      const passage = CATALOG.passages.find(candidate => candidate.id === id);
      assert.ok(actual.includes(passage.text), 'The quote must actually be present in the answer.');
    }
  }

  await withServer({}, async ({ bridge, server, open }) => {
    const view = await open();
    await check('lazy activation, no-JavaScript and sensitive input do not open a PHP conversation', async () => {
      await view.start.waitFor({ state: 'visible' });
      assert.equal(await view.page.locator('#hero-title').isVisible(), true);
      assert.equal(await view.page.locator('#faisca-composer').isVisible(), false);
      assert.equal(view.requests.some(request => request.path === deferredModules[0]), false);
      await view.activate();
      assert.equal(view.requests.filter(request => request.path === deferredModules[0]).length, 1);
      await view.send('Minha senha SYNTHETIC_EXAMPLE');
      assert.equal(view.requests.some(request => request.path.startsWith('/__faisca_lab/')), false);
      assert.doesNotMatch(await view.page.locator('#faisca-log').innerText(), /SYNTHETIC_EXAMPLE/);
      const noJs = await open({ javaScriptEnabled: false });
      assert.equal(await noJs.page.locator('#hero-title').isVisible(), true);
      assert.equal(await noJs.page.locator('.no-script-note').isVisible(), true);
      assert.equal(await noJs.start.isVisible(), false);
      assert.equal(noJs.requests.some(request => request.path.startsWith('/__faisca_lab/')), false);
      assert.equal(server.inspect().createdSessions, 0);
      assert.equal(bridgeCounts(bridge).spawned, 0);
    });
    await check('absent and ambiguous evidence remains local without citations, goal invention or PHP dispatch', async () => {
      const summary = await view.page.locator('#faisca-summary-text').inputValue();
      for (const text of ['O site inclui e-mail?', 'O site usa WordPress?',
        'Quero apresentar minha empresa e captar contatos para uma campanha.']) {
        await view.send(text);
        await view.outcome('answered', 'guided_fallback');
        assert.match(await view.answer(), /Não encontrei|temas ou objetivos diferentes/);
        assert.equal(await view.page.locator('#faisca-log .assistant').last().locator('details').count(), 0);
        assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), summary,
          'Unsupported or ambiguous text cannot invent a commercial objective.');
      }
      assert.equal(server.inspect().dispatched, 0);
      assert.equal(bridgeCounts(bridge).spawned, 0);
    });
    await check('a supported turn uses real PHP and renders exact excerpts with responsive accessible provenance', async () => {
      await view.send('Quero um site para apresentar minha empresa');
      await view.outcome('answered', 'simulated');
      await assertPassages(view, 'goal_presence');
      completedPhp(bridge);
      executedPHP = true;
      assert.equal(server.inspect().dispatched, 1);
      assert.equal(view.apiCount(endpoints.messages), 4, 'Three local guides and one grounded turn share the same HTTP session.');
      for (const width of [320, 390, 1440]) {
        await view.page.setViewportSize({ width, height: 1000 });
        assert.equal(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
          `Open source passages must not overflow at ${width}px.`);
        const audit = await new AxeBuilder({ page: view.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.deepEqual(audit.violations, [], `Source details must pass axe at ${width}px.`);
      }
      axeExecuted = true;
    });
  });

  await check('valid but wrong-topic sources and unsupported extra prose are rejected before manual recovery', async () => {
    for (const fault of ['wrong_topic', 'unsupported_claim']) {
      await withServer({}, async ({ bridge, server, open }) => {
        const view = await open({ fault }); await view.activate();
        const summary = await view.page.locator('#faisca-summary-text').inputValue();
        await view.begin();
        await waitUnknown(view, 'transport_unknown');
        completedPhp(bridge);
        assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), summary);
        assert.doesNotMatch(await view.page.locator('#faisca-log').innerText(), /Meta Ads|garantida para amanhã/,
          'Even a legitimate catalog passage cannot replace a different prepared answer.');
        await reconcileAnswered(view);
        await assertPassages(view, 'goal_presence');
        assert.equal(await view.page.locator('#faisca-log .assistant').count(), 2);
        assert.equal(view.apiCount(endpoints.messages), 1);
        assert.equal(view.apiCount(endpoints.reconcile), 1);
        assert.equal(server.inspect().dispatched, 1);
        completedPhp(bridge);
      });
    }
  });

  await check('delayed PHP keeps original passages pending and inserts them once only after explicit consultation', async () => {
    await withServer({ scenario: 'delay', delayMs: 2000, timeoutMs: 75 }, async ({ bridge, server, open }) => {
      const view = await open(); await view.activate();
      const summary = await view.page.locator('#faisca-summary-text').inputValue();
      await view.begin();
      await waitUnknown(view);
      assert.equal(bridgeCounts(bridge).completed, 0);
      await view.reconcile.click();
      await waitUnknown(view);
      assert.equal(view.apiCount(endpoints.reconcile), 1);
      const chat = await view.page.locator('#faisca-log').innerText();
      assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), summary);
      await eventually(() => bridgeCounts(bridge).completed === 1, 'Actual delayed PHP must finish.');
      assert.equal(await view.page.locator('#faisca-log').innerText(), chat, 'Late completion cannot insert itself.');
      await reconcileAnswered(view);
      await assertPassages(view, 'goal_presence');
      assert.match(await view.page.locator('#faisca-summary-text').inputValue(), /Onepage/);
      assert.equal(await view.page.locator('#faisca-log .assistant').count(), 2);
      assert.equal(view.apiCount(endpoints.messages), 1);
      assert.equal(view.apiCount(endpoints.reconcile), 2);
      assert.equal(server.inspect().dispatched, 1);
      completedPhp(bridge);
    });
  });

  await check('reset and component removal discard pending grounded work and source widgets', async () => {
    for (const lifecycle of ['reset', 'disconnect']) {
      await withServer({ scenario: 'delay', delayMs: 2000, timeoutMs: 200 }, async ({ bridge, server, open }) => {
        const view = await open(); await view.activate(); await view.begin();
        await eventually(() => bridgeCounts(bridge).spawned === 1, 'Lifecycle proof must actually start PHP.');
        if (lifecycle === 'reset') await view.page.locator('#faisca-reset').click();
        else {
          await view.page.evaluate(() => {
            const host = document.querySelector('faisca-grounded-lab');
            const parent = host.parentElement; host.remove(); parent.append(host);
          });
          await view.start.waitFor({ state: 'visible' }); await view.activate();
        }
        await eventually(() => server.inspect().sessions === 0, 'Reset must release the volatile session.');
        await eventually(() => bridgeCounts(bridge).pending === 0, 'Reset must drain the real PHP child.');
        await eventually(() => server.inspect().inflight === 0, 'Reset must drain its HTTP handler.');
        const chat = await view.page.locator('#faisca-log').innerText();
        await view.page.waitForTimeout(75);
        assert.equal(await view.page.locator('#faisca-log').innerText(), chat);
        assert.equal(await view.page.locator('#faisca-log .assistant').count(), 1);
        assert.doesNotMatch(await view.page.locator('#faisca-log').innerText(), /snapshot 84b4c82/);
        assert.doesNotMatch(await view.page.locator('#faisca-summary-text').inputValue(), /Onepage/);
        assert.equal(await view.reconcile.isEnabled(), false);
        assert.equal(server.inspect().dispatched, 1);
        assert.equal(bridgeCounts(bridge).spawned, 1);
      });
    }
  });

  await check('revoked permission and disabled passage source produce explicit local fallback after actual PHP refusal', async () => {
    for (const scenario of ['revoke_before_delivery', 'source_disabled_before_delivery']) {
      await withServer({ scenario }, async ({ bridge, server, open }) => {
        const view = await open(); await view.activate();
        await view.send('Quero um site para apresentar minha empresa');
        await view.outcome('unavailable', 'guided_fallback');
        assert.match(await view.answer(), /indisponível/);
        await assertPassages(view, 'goal_presence', { prefix: true });
        assert.equal(bridgeCounts(bridge).spawned, 1);
        assert.equal(bridgeCounts(bridge).pending, 0);
        assert.equal(server.inspect().dispatched, 1);
        assert.equal(await view.reconcile.isEnabled(), false);
      });
    }
  });

  await check('all grounded cases use only the local allowlist, volatile state and zero browser runtime errors', async () => {
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(runtimeErrors, []);
    assert.equal(executedPHP, true, 'Passing requires observed real PHP completion.');
  });
} catch (error) {
  fatal = { phase, check: currentCheck ?? null, code: error?.code ?? 'qa_failure', message: error.message };
  if (currentCheck) results.push({ name: currentCheck, status: 'fail' });
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mkdir(reports, { recursive: true });
  await writeFile(resolve(reports, 'Faisca_GROUNDING_R06_BROWSER_QA.json'), JSON.stringify({
    status: fatal ? 'failed' : 'passed', executedPHP, phase,
    browser: phase === 'checks' ? 'EXECUTED' : 'NOT_RUN', axe: axeExecuted ? 'EXECUTED' : 'NOT_RUN',
    agentsCommit: configuration?.pin.commit ?? null, knowledgeVersion: configuration?.pin.knowledgeVersion ?? null,
    knowledgeDigest: configuration?.pin.knowledgeDigest ?? null,
    catalogVersion: CATALOG.version, catalogDigest: CATALOG_SHA256,
    scope: 'Synthetic real browser to loopback HTTP to pinned PHP commercial passage retrieval; no external model or operational authority',
    results, unexpectedRequests, runtimeErrors, fixtures, fatal
  }, null, 2) + '\n');
  console.log(`R06 grounded PHP browser: ${results.filter(result => result.status === 'pass').length}/${results.length} passed; executedPHP=${executedPHP}.`);
  if (fatal) console.error(`${fatal.phase}: ${fatal.check ?? fatal.code}: ${fatal.message}`);
}
