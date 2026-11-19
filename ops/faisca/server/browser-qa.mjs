import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startHttpLab } from './http-lab.mjs';
import { KNOWLEDGE } from '../knowledge.mjs';

// Synthetic, loopback-only browser checks. Session credentials and request text
// remain in test memory; neither is written to the report or console output.
const root = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(root, '../output/astro');
const reports = resolve(root, '../reports');
const endpoints = Object.freeze({ sessions: '/__faisca_lab/sessions',
  messages: '/__faisca_lab/messages', reconcile: '/__faisca_lab/reconcile',
  session: '/__faisca_lab/session' });
const results = [], unexpectedRequests = [], runtimeErrors = [], serverSummaries = [];
let browser, phase = 'read_build', fatal;

async function check(name, operation) {
  try { await operation(); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); throw error; }
}

async function eventually(predicate, message, timeout = 3000) {
  const deadline = Date.now() + timeout;
  do {
    if (await predicate()) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 20));
  } while (Date.now() < deadline);
  assert.fail(message);
}

const assets = new Set();
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile()) assets.add('/' + relative(staticDir, path).split(sep).join('/'));
    else throw new Error('Unexpected non-regular laboratory output.');
  }
}

async function withServer(scenario, operation) {
  const server = await startHttpLab({ enabled: '1', port: 0, staticDir, scenario,
    timeoutMs: 250, delayMs: scenario === 'timeout' ? 800 : 40 });
  const contexts = [];
  const fixtures = [];
  async function open({ javaScriptEnabled = true, dropMessageResponse = false } = {}) {
    const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 1440, height: 1000 } });
    contexts.push(context);
    const requests = [], envelopes = [], sessions = [], captureWork = [];
    let dropNextMessage = dropMessageResponse;
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const allowedStatic = method === 'GET' && (url.pathname === '/http/' || assets.has(url.pathname));
      const allowedApi = (method === 'POST' && [endpoints.sessions, endpoints.messages, endpoints.reconcile].includes(url.pathname)) ||
        (method === 'DELETE' && url.pathname === endpoints.session);
      if (url.origin !== server.origin || url.search || (!allowedStatic && !allowedApi)) {
        // Deliberately omit query, headers and body even on failure.
        unexpectedRequests.push({ scenario, method, path: url.pathname });
        await route.abort(); return;
      }
      requests.push({ method, path: url.pathname });
      if (method === 'POST' && url.pathname === endpoints.messages) {
        envelopes.push(request.postDataJSON());
        if (dropNextMessage) {
          dropNextMessage = false;
          // The server has completed this exact request; simulate loss of its
          // response at the browser boundary, not a second provider invocation.
          await route.fetch({ maxRedirects: 0 });
          await route.abort('failed');
          return;
        }
      }
      await route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => runtimeErrors.push({ scenario, message: error.message }));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname === endpoints.sessions && response.ok()) {
        captureWork.push(response.json().then(value => { sessions.push(value); }).catch(() => {}));
      }
    });
    await page.goto(server.origin + '/http/', { waitUntil: 'load' });
    const fixture = { context, page, requests, envelopes, sessions,
      root: page.locator('[data-faisca-root]'),
      start: page.locator('[data-faisca-http-start]'),
      reconcile: page.locator('[data-faisca-http-reconcile]'),
      reconciliation: page.locator('[data-faisca-http-reconciliation]'),
      async flush() { await Promise.all(captureWork); },
      apiCount(path) { return requests.filter(item => item.path === path).length; },
      async activate() {
        await fixture.start.waitFor({ state: 'visible' });
        await fixture.start.click();
        await page.locator('#faisca-composer').waitFor({ state: 'visible' });
        assert.match(await page.locator('[data-faisca-http-status]').innerText(), /laboratório|simulado/i);
      },
      async send(text) {
        const count = await page.locator('#faisca-log .assistant').count();
        await page.locator('#faisca-input').fill(text);
        await page.locator('#faisca-send').click();
        await page.waitForFunction(previous => {
          const log = document.querySelector('#faisca-log');
          return log.getAttribute('aria-busy') === 'false' && log.querySelectorAll('.assistant').length === previous + 1;
        }, count);
        await fixture.flush();
      },
      async outcome(status, delivery) {
        assert.equal(await fixture.root.getAttribute('data-faisca-status'), status);
        assert.equal(await fixture.root.getAttribute('data-faisca-delivery'), delivery);
      },
      async answer() { return page.locator('#faisca-log .assistant .message-body').last().innerText(); }
    };
    fixtures.push(fixture);
    return fixture;
  }
  let completed = false;
  try { await operation({ server, open }); completed = true; }
  finally {
    try {
      if (completed) for (const fixture of fixtures) {
        if (!fixture.page.isClosed()) {
          assert.deepEqual(await fixture.context.cookies(), [], 'HTTP laboratory must not set cookies');
          assert.deepEqual(await fixture.page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
            { local: 0, session: 0 }, 'HTTP credentials and messages must remain volatile');
        }
      }
    } finally {
      for (const context of contexts) await context.close();
      await server.close();
      if (completed) await eventually(() => server.inspect().sockets === 0,
        'closing the fixture left a socket registered after its close event');
      const counts = server.inspect();
      serverSummaries.push({ scenario, ...Object.fromEntries(['live', 'sessions', 'sockets', 'inflight',
        'createdSessions', 'expiredSessions', 'dispatched', 'messages', 'reconciliations'].map(key => [key, counts[key]])) });
      if (completed) {
        assert.equal(counts.live, false);
        assert.equal(counts.sessions, 0, 'closing the fixture must release its volatile sessions');
        assert.equal(counts.inflight, 0, 'closing the fixture must drain its HTTP handlers');
      }
    }
  }
}

async function sendUntilUnknown(view, status = 'unknown', text = 'Qual a diferença entre Onepage e Landing Page?') {
  await view.page.locator('#faisca-input').fill(text);
  await view.page.locator('#faisca-send').click();
  await view.page.locator(`[data-faisca-http-state="${status}"]`).waitFor({ state: 'visible' });
  assert.equal(await view.page.locator('#faisca-log').getAttribute('aria-busy'), 'true');
  assert.equal(await view.page.locator('#faisca-send').isEnabled(), false);
  assert.equal(await view.reconcile.isEnabled(), true);
  await view.flush();
}

async function reconcileAnswered(view) {
  await view.reconcile.click();
  await view.reconciliation.filter({ hasText: 'Resposta conciliada:' }).waitFor({ state: 'visible' });
  await view.page.waitForFunction(() => document.querySelector('#faisca-log').getAttribute('aria-busy') === 'false');
  await view.outcome('answered', 'simulated');
}

async function postFromPage(fixture, path, token, body) {
  return fixture.page.evaluate(async ({ path, token, body }) => {
    const response = await fetch(path, { method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { path, token, body });
}

try {
  await collect(staticDir);
  assert.deepEqual([...assets].filter(path => path.endsWith('.html')).sort(), ['/grounded/index.html', '/http/index.html', '/index.html', '/journey-http-r08/index.html', '/journey-http/index.html', '/journey/index.html', '/support/index.html']);
  const httpUi = [...assets].filter(path => /\/_astro\/http-ui\.[^/]+\.js$/.test(path));
  assert.ok(httpUi.length >= 1, 'The isolated lab must include deferred HTTP UI modules.');
  const html = await readFile(resolve(staticDir, 'http/index.html'), 'utf8');
  assert.ok(!html.includes('Bearer '), 'built HTML cannot embed session credentials');
  phase = 'browser_launch';
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  phase = 'checks';

  await withServer('success', async ({ server, open }) => {
    const a = await open();
    await check('HTTP page is readable and creates no session before activation or the first message', async () => {
      await a.start.waitFor({ state: 'visible' });
      assert.equal(await a.page.locator('#hero-title').isVisible(), true);
      assert.equal(await a.page.locator('#faisca-master').evaluate(image => image.complete && image.naturalWidth === 1254), true);
      assert.equal(await a.page.locator('#faisca-composer').isVisible(), false);
      assert.equal(a.requests.some(item => httpUi.includes(item.path)), false);
      assert.equal(a.requests.some(item => item.path.startsWith('/__faisca_lab/')), false);
      assert.equal(await a.page.locator('[data-faisca-lab-scenario]').count(), 0, 'provider selection belongs to server configuration');
      await a.activate();
      assert.equal(a.apiCount(endpoints.sessions), 0);
      assert.equal(server.inspect().createdSessions, 0);
      assert.equal(server.inspect().dispatched, 0);
      assert.equal(a.requests.filter(item => httpUi.includes(item.path)).length, 1, 'The /http/ page must load exactly its own deferred UI module.');
    });
    await check('sensitive input is handled locally before creating any HTTP session', async () => {
      await a.send('Minha senha SYNTHETIC_EXAMPLE');
      assert.equal(a.requests.some(item => item.path.startsWith('/__faisca_lab/')), false);
      assert.equal(server.inspect().createdSessions, 0);
      assert.equal(server.inspect().dispatched, 0);
      assert.doesNotMatch(await a.page.locator('#faisca-log').innerText(), /SYNTHETIC_EXAMPLE/);
    });
    await check('a real browser request creates one volatile session and reuses it across guided turns', async () => {
      await a.send('Qual a diferença entre Onepage e Landing Page?');
      await a.outcome('answered', 'simulated');
      assert.match(await a.answer(), /Onepage/);
      assert.equal(a.sessions.length, 1);
      assert.equal(a.apiCount(endpoints.sessions), 1);
      assert.equal(server.inspect().dispatched, 1);
      const session = a.sessions[0];
      assert.equal(session.schema, 'faisca.http.session.v1');
      assert.equal(/^[a-f0-9]{32}$/.test(session.conversationId), true);
      assert.equal(/^[a-f0-9]{64}$/.test(session.token), true);
      assert.deepEqual(session.context, { scope: 'public_comercial', knowledgeVersion: KNOWLEDGE.version,
        provider: 'simulated', operationalEffects: false });
      await a.send('Como funciona o investimento?');
      assert.equal(a.apiCount(endpoints.sessions), 1);
      assert.equal(server.inspect().dispatched, 2);
      assert.match(await a.answer(), /Portal/);
    });
    await check('identical HTTP replay reuses the result and altered message content conflicts without dispatch', async () => {
      const before = server.inspect().dispatched;
      const request = a.envelopes.at(-1);
      const replay = await postFromPage(a, endpoints.messages, a.sessions[0].token, request);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.status, 'answered');
      const conflict = await postFromPage(a, endpoints.messages, a.sessions[0].token,
        { ...request, input: { type: 'text', text: 'Uma mensagem diferente com o mesmo identificador' } });
      assert.equal(conflict.status, 200);
      assert.equal(conflict.body.status, 'conflict');
      assert.equal(server.inspect().dispatched, before);
    });
    await check('two browser sessions cannot claim each other or add authority and provider fields', async () => {
      const b = await open();
      await b.activate();
      await b.send('Quero organizar minhas vendas');
      assert.equal(b.sessions.length, 1);
      assert.ok(a.sessions[0].conversationId !== b.sessions[0].conversationId, 'independent conversations');
      assert.ok(a.sessions[0].token !== b.sessions[0].token, 'independent session credentials');
      const before = server.inspect().dispatched;
      const crossSession = await postFromPage(a, endpoints.messages, a.sessions[0].token, b.envelopes[0]);
      assert.equal(crossSession.status, 403);
      const injected = await postFromPage(a, endpoints.messages, a.sessions[0].token,
        { ...a.envelopes[0], tenant_id: 'SYNTHETIC_OTHER', role: 'admin', provider: 'unreviewed' });
      assert.equal(injected.status, 400);
      assert.equal(server.inspect().dispatched, before);
      assert.doesNotMatch(await a.page.locator('#faisca-summary-text').inputValue(), /Imagine CRM/);
      assert.match(await b.page.locator('#faisca-summary-text').inputValue(), /Imagine CRM/);
    });
    await check('HTTP controls fit three target widths and pass axe without exposing session credentials', async () => {
      for (const width of [1440, 390, 320]) {
        await a.page.setViewportSize({ width, height: 1000 });
        assert.equal(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
        const result = await new AxeBuilder({ page: a.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.deepEqual(result.violations, [], `axe at ${width}`);
      }
      const rendered = await a.page.content();
      assert.ok(!rendered.includes(a.sessions[0].token), 'session credential cannot enter DOM');
    });
    await check('the HTTP page remains readable without JavaScript and never opens a session', async () => {
      const before = server.inspect().createdSessions;
      const staticView = await open({ javaScriptEnabled: false });
      assert.equal(await staticView.page.locator('#hero-title').isVisible(), true);
      assert.equal(await staticView.start.isVisible(), false);
      assert.equal(await staticView.reconcile.isVisible(), false);
      assert.equal(await staticView.page.locator('#faisca-composer').isVisible(), false);
      assert.equal(await staticView.page.locator('.no-script-note').isVisible(), true);
      assert.equal(staticView.requests.some(item => item.path.startsWith('/__faisca_lab/')), false);
      assert.equal(server.inspect().createdSessions, before);
    });
  });

  for (const [scenario, status, message] of [
    ['unavailable', 'unavailable', /indisponível/i],
    ['limit', 'provider_limit', /limite/i],
    ['malformed', 'invalid_response', /validação/i]
  ]) {
    await withServer(scenario, async ({ server, open }) => {
      await check(`server-selected ${scenario} produces a validated guided fallback through HTTP`, async () => {
        const view = await open(); await view.activate();
        await view.send('Qual a diferença entre Onepage e Landing Page?');
        await view.outcome(status, 'guided_fallback');
        assert.match(await view.answer(), message);
        assert.match(await view.answer(), /Onepage/);
        assert.equal(server.inspect().dispatched, 1);
        assert.equal(await view.page.locator('#faisca-log script, #faisca-log iframe, #faisca-log img, #faisca-log a').count(), 0);
        assert.equal(await view.reconcile.isEnabled(), false);
      });
    });
  }

  await withServer('timeout', async ({ server, open }) => {
    await check('timeout stays pending and manual reconciliation completes the original turn exactly once', async () => {
      const view = await open(); await view.activate();
      const beforeSummary = await view.page.locator('#faisca-summary-text').inputValue();
      await sendUntilUnknown(view, 'unknown', 'Quero organizar minhas vendas');
      assert.equal(server.inspect().dispatched, 1);
      const chat = await view.page.locator('#faisca-log').innerText();
      assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), beforeSummary);
      await view.page.waitForTimeout(1000);
      assert.equal(await view.page.locator('#faisca-log').innerText(), chat, 'late result does not insert itself into the chat');
      await reconcileAnswered(view);
      assert.match(await view.reconciliation.innerText(), /Imagine CRM/);
      assert.match(await view.answer(), /Imagine CRM/);
      assert.equal(view.apiCount(endpoints.messages), 1);
      assert.equal(view.apiCount(endpoints.reconcile), 1);
      assert.equal(server.inspect().dispatched, 1);
      assert.equal(server.inspect().reconciliations, 1);
      assert.equal(await view.page.locator('#faisca-log .assistant').count(), 2);
      assert.equal(await view.page.locator('#faisca-log .user').count(), 1);
      const finishedChat = await view.page.locator('#faisca-log').innerText();
      const finishedSummary = await view.page.locator('#faisca-summary-text').inputValue();
      assert.match(finishedSummary, /Imagine CRM/);
      await view.page.waitForTimeout(100);
      assert.equal(await view.page.locator('#faisca-log').innerText(), finishedChat);
      assert.equal(await view.page.locator('#faisca-summary-text').inputValue(), finishedSummary);
      assert.equal(await view.reconcile.isEnabled(), false);
    });
  });

  await withServer('timeout', async ({ server, open }) => {
    await check('reset after HTTP dispatch disposes the session and discards late completion', async () => {
      const view = await open(); await view.activate();
      await view.page.locator('#faisca-input').fill('Quero organizar minhas vendas');
      await view.page.locator('#faisca-send').click();
      await eventually(() => server.inspect().dispatched === 1, 'message did not reach the server');
      await view.page.locator('#faisca-reset').click();
      await eventually(() => server.inspect().sessions === 0, 'reset did not dispose its server session');
      const snapshot = await view.page.locator('#faisca-log').innerText();
      await view.page.waitForTimeout(1000);
      assert.equal(await view.page.locator('.chat-message').count(), 1);
      assert.equal(await view.page.locator('#faisca-log').innerText(), snapshot);
      assert.equal(await view.root.getAttribute('data-faisca-status'), null);
      assert.equal(await view.reconcile.isEnabled(), false);
      assert.equal(await view.reconciliation.innerText(), '');
      assert.equal(view.apiCount(endpoints.messages), 1);
      assert.equal(view.apiCount(endpoints.session), 1);
      assert.equal(server.inspect().dispatched, 1);
      assert.doesNotMatch(await view.page.locator('#faisca-summary-text').inputValue(), /Imagine CRM/);
    });
  });

  await withServer('timeout', async ({ server, open }) => {
    await check('disconnecting the HTTP component invalidates pending work before a clean remount', async () => {
      const view = await open(); await view.activate();
      await view.page.locator('#faisca-input').fill('Quero organizar minhas vendas');
      await view.page.locator('#faisca-send').click();
      await eventually(() => server.inspect().dispatched === 1, 'message did not reach the server');
      await view.page.evaluate(() => {
        const host = document.querySelector('faisca-http-lab');
        const parent = host.parentElement; host.remove(); parent.append(host);
      });
      await view.start.waitFor({ state: 'visible' });
      await eventually(() => server.inspect().sessions === 0, 'disconnect did not dispose its server session');
      assert.equal(await view.page.locator('.chat-message').count(), 0);
      await view.activate();
      const snapshot = await view.page.locator('#faisca-log').innerText();
      await view.page.waitForTimeout(1000);
      assert.equal(await view.page.locator('#faisca-log').innerText(), snapshot);
      assert.equal(await view.page.locator('.chat-message').count(), 1);
      assert.equal(await view.reconcile.isEnabled(), false);
      assert.equal(server.inspect().createdSessions, 1, 'remount alone does not create a replacement session');
      assert.equal(server.inspect().dispatched, 1);
    });
  });

  await withServer('success', async ({ server, open }) => {
    await check('a lost HTTP response remains unknown and manual reconciliation does not redispatch', async () => {
      const view = await open({ dropMessageResponse: true }); await view.activate();
      await sendUntilUnknown(view, 'transport_unknown');
      assert.equal(server.inspect().dispatched, 1);
      assert.equal(await view.page.locator('#faisca-log .assistant').count(), 1);
      await reconcileAnswered(view);
      assert.match(await view.reconciliation.innerText(), /Onepage/);
      assert.equal(await view.page.locator('#faisca-log .assistant').count(), 2);
      assert.equal(view.apiCount(endpoints.messages), 1);
      assert.equal(view.apiCount(endpoints.reconcile), 1);
      assert.equal(server.inspect().dispatched, 1);
    });
  });
  await check('all HTTP browser scenarios remain on the local allowlist without runtime errors', async () => {
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(runtimeErrors, []);
  });
} catch (error) {
  fatal = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mkdir(reports, { recursive: true });
  await writeFile(resolve(reports, 'Faisca_HTTP_R04_BROWSER_QA.json'), JSON.stringify({
    status: fatal ? (phase === 'browser_launch' ? 'blocked_environment' : 'failed') : 'passed',
    phase, browser: phase === 'checks' ? 'EXECUTED' : 'NOT_RUN',
    axe: results.some(result => result.name.includes('axe')) ? 'EXECUTED' : 'NOT_RUN',
    scope: 'Synthetic loopback HTTP laboratory; no operational deployment or authentication claim',
    results, unexpectedRequests, runtimeErrors, serverSummaries, fatal
  }, null, 2) + '\n');
  if (fatal) console.error(fatal);
}
