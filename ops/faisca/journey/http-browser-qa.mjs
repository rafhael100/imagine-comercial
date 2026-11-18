import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startHttpLab } from '../server/http-lab.mjs';
import { HTTP_PATHS, HTTP_RESULT_SCHEMA } from '../http-contract.mjs';
import { CONVERSATION_SCHEMA } from '../conversation-contract.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';
import { prepareGroundedBridge } from '../grounding/php-provider.mjs';
import { bridgeCounts, eventually, readGroundedQaConfiguration } from '../grounding/check-interop.mjs';
import { createJourneyPrepareTurn } from './http-runtime.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(root, '../output/astro');
const reports = resolve(root, '../reports');
const endpoints = HTTP_PATHS;
const results = [], unexpected = [], runtimeErrors = [];
let configuration, bridge, server, browser, context, fatal, executedPHP = false;

async function collect(directory, base = directory, files = new Set()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path, base, files);
    else if (entry.isFile()) files.add('/' + relative(base, path).split(sep).join('/'));
    else throw new Error('R07 HTTP lab contains a non-regular static file.');
  }
  return files;
}
async function check(name, run) {
  try { await run(); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); throw error; }
}
const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));

async function browserFetch(page, path, method, body, token) {
  return page.evaluate(async ({ path, method, body, token }) => {
    const response = await fetch(path, {
      method, credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body)
    });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data };
  }, { path, method, body, token });
}

try {
  configuration = await readGroundedQaConfiguration();
  const pinCheck = await prepareGroundedBridge(configuration);
  await pinCheck.close();
  const files = await collect(staticDir);
  assert.ok(files.has('/journey-http/index.html'), 'Build the isolated R07 HTTP route first.');
  assert.deepEqual([...files].filter(path => path.endsWith('.html')).sort(), [
    '/grounded/index.html', '/http/index.html', '/index.html', '/journey-http/index.html', '/journey/index.html'
  ], 'The R07 HTTP lab build must contain only the five reviewed pages.');
  bridge = await prepareGroundedBridge({ ...configuration, scenario: 'delay', delayMs: 2000, processDeadlineMs: 3000 });
  server = await startHttpLab({
    enabled: '1', port: 0, staticDir, createProvider: bridge.createProvider,
    prepareTurnFactory: createJourneyPrepareTurn, timeoutMs: 75, sessionTtlMs: 300000
  });
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const staticRequest = method === 'GET' && (url.pathname === '/journey-http/' || files.has(url.pathname));
    const apiRequest = (method === 'POST' && [endpoints.sessions, endpoints.messages, endpoints.reconcile].includes(url.pathname)) ||
      (method === 'DELETE' && url.pathname === endpoints.session);
    if (url.origin !== server.origin || url.search || (!staticRequest && !apiRequest)) {
      unexpected.push({ method, path: url.pathname });
      await route.abort(); return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const sessionCaptures = [];
  page.on('response', response => {
    if (new URL(response.url()).pathname === endpoints.sessions && response.status() === 201) {
      sessionCaptures.push(response.json().catch(() => null));
    }
  });
  await page.goto(server.origin + '/journey-http/', { waitUntil: 'load' });
  const rootElement = page.locator('[data-faisca-root]');
  const status = page.locator('[data-faisca-http-status]');
  const reconcileButton = page.locator('[data-faisca-http-reconcile]');
  const lastAnswer = () => page.locator('#faisca-log .assistant .message-body').last();
  const assistantCount = () => page.locator('#faisca-log .assistant').count();
  async function waitAnswer(previous) {
    await page.waitForFunction(count => {
      const log = document.querySelector('#faisca-log');
      return log && log.getAttribute('aria-busy') === 'false' &&
        log.querySelectorAll('.assistant').length === count + 1;
    }, previous, { timeout: 10000 });
  }
  async function activate() {
    await page.locator('[data-faisca-http-start]').click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await rootElement.getAttribute('data-faisca-mode'), 'r07_http_php_lab');
  }
  async function sendText(value) {
    const previous = await assistantCount();
    await page.locator('#faisca-input').fill(value);
    await page.locator('#faisca-send').click();
    await waitAnswer(previous);
  }
  async function choose(value) {
    const previous = await assistantCount();
    await page.locator('#faisca-quick-actions [data-action-id="' + value + '"]').click();
    await waitAnswer(previous);
  }
  async function startUnknownAction(value = 'confirm_goal') {
    await page.locator('#faisca-quick-actions [data-action-id="' + value + '"]').click();
    await page.locator('[data-faisca-http-status][data-faisca-http-state="unknown"]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('#faisca-send').isEnabled(), false);
    assert.equal(await reconcileButton.isEnabled(), true);
  }
  async function consult() {
    const before = await assistantCount();
    await reconcileButton.click();
    await waitAnswer(before);
    await page.locator('[data-faisca-http-reconciliation]').filter({ hasText: 'Resposta conciliada:' }).waitFor({ state: 'visible' });
    assert.equal(await rootElement.getAttribute('data-faisca-status'), 'answered');
    assert.equal(await rootElement.getAttribute('data-faisca-delivery'), 'simulated');
  }
  function phpCounts() { return bridgeCounts(bridge); }
  async function assertGrounded(answerId) {
    const expected = getGroundedAnswer(answerId);
    assert.equal(await lastAnswer().innerText(), expected.text);
    const details = page.locator('#faisca-log .assistant').last().locator('details.message-sources');
    assert.equal(await details.count(), 1);
    await details.locator('summary').click();
    assert.deepEqual(await details.locator('li').allTextContents(), expected.sources.map(source => source.title));
  }

  await check('R07 HTTP page is isolated, no session or PHP process exists before explicit activation', async () => {
    await page.locator('[data-faisca-http-start]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await assistantCount(), 0);
    assert.equal(server.inspect().createdSessions, 0);
    assert.equal(phpCounts().spawned, 0);
    assert.equal(await page.locator('#faisca-master').evaluate(img => img.complete && img.naturalWidth === 1254), true);
    await activate();
    assert.equal(phpCounts().spawned, 0);
  });

  await check('R07 proposal is stored in the server session without PHP and confirmation requires a real PHP-backed answer', async () => {
    await sendText('Quero apresentar minha empresa.');
    assert.match(await lastAnswer().innerText(), /Confirme a escolha/);
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Objetivo ainda não selecionado/);
    assert.equal(phpCounts().spawned, 0, 'A proposal is a local state transition, not a model request.');
    assert.equal(server.inspect().messages, 1);
    await startUnknownAction('confirm_goal');
    const summaryBefore = await page.locator('#faisca-summary-text').inputValue();
    assert.match(summaryBefore, /Objetivo ainda não selecionado/);
    await eventually(() => phpCounts().spawned === 1, 'The confirmation must spawn the pinned PHP CLI.');
    assert.equal(phpCounts().completed, 0, 'The delayed PHP process must still be pending at timeout.');
    const chatBefore = await page.locator('#faisca-log').innerText();
    await reconcileButton.click();
    await page.locator('[data-faisca-http-status][data-faisca-http-state="unknown"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#faisca-log').innerText(), chatBefore);
    assert.equal(await page.locator('#faisca-summary-text').inputValue(), summaryBefore);
    await eventually(() => phpCounts().completed === 1, 'The actual PHP child must finish before reconciliation.', 5000);
    assert.equal(await page.locator('#faisca-log').innerText(), chatBefore, 'Late PHP completion cannot update the UI by itself.');
    assert.equal(await page.locator('#faisca-summary-text').inputValue(), summaryBefore);
    await consult();
    await assertGrounded('goal_presence');
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
    assert.equal(phpCounts().spawned, 1);
    assert.equal(phpCounts().completed, 1);
    executedPHP = true;
  });

  await check('R07 reset during a pending PHP answer destroys the old HTTP session and discards late delivery', async () => {
    const beforeCount = await assistantCount();
    await page.locator('#faisca-input').fill('Como funciona o projeto?');
    await page.locator('#faisca-send').click();
    await page.locator('[data-faisca-http-status][data-faisca-http-state="unknown"]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await assistantCount(), beforeCount);
    await eventually(() => phpCounts().spawned === 2, 'The second turn must start a real PHP process before reset.');
    await page.locator('#faisca-reset').click();
    await eventually(() => server.inspect().sessions === 0, 'Reset must release the server-issued session.');
    await eventually(() => phpCounts().pending === 0, 'Reset must terminate/drain the owned real PHP child.');
    await eventually(() => server.inspect().inflight === 0, 'Reset must drain the HTTP handler.');
    assert.equal(await assistantCount(), 1);
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Objetivo ainda não selecionado/);
    assert.equal(await reconcileButton.isEnabled(), false);
    const cleanChat = await page.locator('#faisca-log').innerText();
    await wait(150);
    assert.equal(await page.locator('#faisca-log').innerText(), cleanChat);
    assert.doesNotMatch(cleanChat, /Site Onepage|Como funciona o projeto/);
    assert.equal(phpCounts().spawned, 2);
  });

  await check('R07 new session after reset can select Landing Page independently', async () => {
    await sendText('Preciso captar contatos para uma oferta.');
    assert.match(await lastAnswer().innerText(), /Confirme a escolha/);
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Objetivo ainda não selecionado/);
    await startUnknownAction('confirm_goal');
    await eventually(() => phpCounts().spawned === 3, 'The replacement session must spawn a fresh PHP process.');
    await eventually(() => phpCounts().completed === 2, 'The new session PHP child must complete.', 5000);
    await consult();
    await assertGrounded('goal_campaign');
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Landing Page/);
    assert.doesNotMatch(await page.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
    executedPHP = true;
  });

  await check('R07 two server sessions accept the same message ID without crossing choices or PHP results', async () => {
    const [sessionA, sessionB] = await Promise.all([
      browserFetch(page, endpoints.sessions, 'POST', {}, null),
      browserFetch(page, endpoints.sessions, 'POST', {}, null)
    ]);
    assert.equal(sessionA.status, 201); assert.equal(sessionB.status, 201);
    const a = sessionA.data, b = sessionB.data;
    assert.notEqual(a.conversationId, b.conversationId);
    const proposalA = await browserFetch(page, endpoints.messages, 'POST', {
      schema: CONVERSATION_SCHEMA, conversationId: a.conversationId, messageId: 'r07_proposal_A_0001',
      locale: 'pt-BR', input: { type: 'text', text: 'Quero apresentar minha empresa.' }
    }, a.token);
    const proposalB = await browserFetch(page, endpoints.messages, 'POST', {
      schema: CONVERSATION_SCHEMA, conversationId: b.conversationId, messageId: 'r07_proposal_B_0001',
      locale: 'pt-BR', input: { type: 'text', text: 'Preciso captar contatos para uma oferta.' }
    }, b.token);
    assert.equal(proposalA.data.status, 'answered'); assert.equal(proposalB.data.status, 'answered');
    assert.equal(proposalA.data.delivery, 'guided_fallback'); assert.equal(proposalB.data.delivery, 'guided_fallback');
    const before = phpCounts();
    const sharedMessageId = 'r07_shared_confirm_0001';
    const [confirmA, confirmB] = await Promise.all([
      browserFetch(page, endpoints.messages, 'POST', {
        schema: CONVERSATION_SCHEMA, conversationId: a.conversationId, messageId: sharedMessageId,
        locale: 'pt-BR', input: { type: 'action', id: 'confirm_goal' }
      }, a.token),
      browserFetch(page, endpoints.messages, 'POST', {
        schema: CONVERSATION_SCHEMA, conversationId: b.conversationId, messageId: sharedMessageId,
        locale: 'pt-BR', input: { type: 'action', id: 'confirm_goal' }
      }, b.token)
    ]);
    assert.equal(confirmA.data.status, 'unknown'); assert.equal(confirmB.data.status, 'unknown');
    await eventually(() => phpCounts().spawned === before.spawned + 2, 'Both sessions must spawn independent PHP children.');
    await eventually(() => phpCounts().completed === before.completed + 2,
      'Both isolated PHP children must complete independently.', 5000);
    const [answerA, answerB] = await Promise.all([
      browserFetch(page, endpoints.reconcile, 'POST', {
        schema: CONVERSATION_SCHEMA, conversationId: a.conversationId, messageId: sharedMessageId,
        locale: 'pt-BR', input: { type: 'action', id: 'confirm_goal' }
      }, a.token),
      browserFetch(page, endpoints.reconcile, 'POST', {
        schema: CONVERSATION_SCHEMA, conversationId: b.conversationId, messageId: sharedMessageId,
        locale: 'pt-BR', input: { type: 'action', id: 'confirm_goal' }
      }, b.token)
    ]);
    for (const value of [answerA.data, answerB.data]) {
      assert.equal(value.schema, HTTP_RESULT_SCHEMA);
      assert.equal(value.status, 'answered');
      assert.equal(value.delivery, 'simulated');
    }
    assert.equal(answerA.data.response.text, getGroundedAnswer('goal_presence').text);
    assert.equal(answerB.data.response.text, getGroundedAnswer('goal_campaign').text);
    assert.notDeepEqual(answerA.data.response.sources, answerB.data.response.sources);
    const wrongContext = await browserFetch(page, endpoints.reconcile, 'POST', {
      schema: CONVERSATION_SCHEMA, conversationId: b.conversationId, messageId: sharedMessageId,
      locale: 'pt-BR', input: { type: 'action', id: 'confirm_goal' }
    }, a.token);
    assert.equal(wrongContext.status, 403, 'A session token cannot consult another conversation ID.');
    await Promise.all([a, b].map(session => browserFetch(page, endpoints.session, 'DELETE', {}, session.data.token)));
    await eventually(() => server.inspect().sessions === 1, 'Both raw test sessions must be deleted while the browser session remains.');
    assert.equal(phpCounts().spawned, before.spawned + 2);
    assert.equal(phpCounts().completed, before.completed + 2);
    executedPHP = true;
  });

  await check('R07 HTTP conversation is responsive, accessible and makes no external request or browser persistence', async () => {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(item => item.id), [], 'R07 HTTP accessibility at ' + width + 'px');
    }
    assert.deepEqual(unexpected, []);
    assert.deepEqual(runtimeErrors, []);
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie })),
      { local: 0, session: 0, cookie: '' });
    assert.equal(executedPHP, true, 'This gate requires observed PHP CLI execution.');
  });

} catch (error) {
  fatal = { phase: 'R07_HTTP_BROWSER', code: error?.code ?? 'qa_failure', message: error.message };
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await bridge?.close().catch(() => {});
  if (bridge) {
    await eventually(() => bridgeCounts(bridge).pending === 0, 'R07 left a real PHP process pending.', 5000).catch(() => {});
  }
  await mkdir(reports, { recursive: true });
  await writeFile(resolve(reports, 'Faisca_R07_HTTP_BROWSER_QA.json'), JSON.stringify({
    status: fatal ? 'failed' : 'passed', executedPHP,
    agentsCommit: configuration?.pin.commit ?? null,
    knowledgeVersion: configuration?.pin.knowledgeVersion ?? null,
    knowledgeDigest: configuration?.pin.knowledgeDigest ?? null,
    scope: 'Synthetic Chromium -> loopback HTTP -> server-scoped R07 journey -> pinned PHP Agents; no external model or operational effects',
    php: bridge ? bridgeCounts(bridge) : null,
    server: server ? server.inspect() : null,
    results, unexpected, runtimeErrors, fatal
  }, null, 2) + '\n');
  console.log('R07 HTTP/PHP browser: ' + results.filter(item => item.status === 'pass').length + '/' + results.length +
    ' passed; executedPHP=' + executedPHP + '.');
  if (fatal) console.error(fatal.phase + ': ' + fatal.code + ': ' + fatal.message);
}
