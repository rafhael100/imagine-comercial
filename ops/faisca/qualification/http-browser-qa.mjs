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
import { createQualificationPrepareTurn } from './http-runtime.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(root, '../output/astro');
const reports = resolve(root, '../reports');
const endpoints = HTTP_PATHS;
const results = [], unexpected = [], runtimeErrors = [], httpFailures = [];
let configuration, bridge, server, browser, context, fatal, executedPHP = false;
let expectedResetTerminations = 0;

async function collect(directory, base = directory, files = new Set()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path, base, files);
    else if (entry.isFile()) files.add('/' + relative(base, path).split(sep).join('/'));
    else throw new Error('R08 HTTP lab contains a non-regular static file.');
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
  assert.ok(files.has('/journey-http-r08/index.html'), 'Build the isolated R08 HTTP route first.');
  assert.deepEqual([...files].filter(path => path.endsWith('.html')).sort(), [
    '/grounded/index.html', '/http/index.html', '/index.html',
    '/journey-http-r08/index.html', '/journey-http/index.html', '/journey/index.html'
  ], 'The R08 HTTP lab build must contain only the six reviewed pages.');
  bridge = await prepareGroundedBridge({ ...configuration, scenario: 'delay', delayMs: 2000, processDeadlineMs: 3000 });
  server = await startHttpLab({
    enabled: '1', port: 0, staticDir, createProvider: bridge.createProvider,
    prepareTurnFactory: createQualificationPrepareTurn, timeoutMs: 75, sessionTtlMs: 300000
  });
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const staticRequest = method === 'GET' && (url.pathname === '/journey-http-r08/' || files.has(url.pathname));
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
  page.on('response', async response => {
    const path = new URL(response.url()).pathname;
    if (Object.values(HTTP_PATHS).includes(path) && response.status() >= 400) {
      let body = null;
      try { body = await response.json(); } catch { /* Keep only the status if the body is not JSON. */ }
      httpFailures.push({ path, status: response.status(), body });
    }
  });
  await page.goto(server.origin + '/journey-http-r08/', { waitUntil: 'load' });
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
    assert.equal(await rootElement.getAttribute('data-faisca-mode'), 'r08_http_php_lab');
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
  async function waitUnknown() {
    await page.locator('[data-faisca-http-status][data-faisca-http-state="unknown"]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('#faisca-send').isEnabled(), false);
    assert.equal(await reconcileButton.isEnabled(), true);
  }
  async function reconcileUi() {
    const before = await assistantCount();
    await reconcileButton.click();
    await waitAnswer(before);
    await page.locator('[data-faisca-http-reconciliation]').filter({ hasText: 'Resposta conciliada:' }).waitFor({ state: 'visible' });
    assert.equal(await rootElement.getAttribute('data-faisca-status'), 'answered');
    assert.equal(await rootElement.getAttribute('data-faisca-delivery'), 'simulated');
  }
  function phpCounts() { return bridgeCounts(bridge); }
  async function assertGroundedSource(answerId) {
    const expected = getGroundedAnswer(answerId);
    assert.ok((await lastAnswer().innerText()).includes(expected.text));
    const details = page.locator('#faisca-log .assistant').last().locator('details.message-sources');
    assert.equal(await details.count(), 1);
    await details.locator('summary').click();
    assert.deepEqual(await details.locator('li').allTextContents(), expected.sources.map(source => source.title));
  }

  await check('R08 HTTP page is isolated and creates no session or PHP process before activation', async () => {
    await page.locator('[data-faisca-http-start]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await assistantCount(), 0);
    assert.equal(server.inspect().createdSessions, 0);
    assert.equal(phpCounts().spawned, 0);
    assert.equal(await page.locator('#faisca-master').evaluate(img => img.complete && img.naturalWidth === 1254), true);
    await activate();
    assert.equal(phpCounts().spawned, 0);
  });

  await check('R08 proposal and closed qualification choices remain local; confirmed service answer is PHP-grounded', async () => {
    await sendText('Quero apresentar minha empresa.');
    assert.match(await lastAnswer().innerText(), /Confirme a escolha/);
    assert.equal(phpCounts().spawned, 0, 'Proposal is a local state transition.');
    const beforeConfirm = await assistantCount();
    await page.locator('#faisca-quick-actions [data-action-id="confirm_goal"]').click();
    await waitUnknown();
    await eventually(() => phpCounts().spawned === 1, 'The confirmed Onepage passage must start real PHP.');
    const chatBefore = await page.locator('#faisca-log').innerText();
    await eventually(() => phpCounts().completed === 1, 'The PHP answer must complete before reconciliation.', 5000);
    assert.equal(await page.locator('#faisca-log').innerText(), chatBefore, 'Late PHP completion cannot update the UI automatically.');
    await reconcileUi();
    assert.equal(await assistantCount(), beforeConfirm + 1);
    assert.match(await lastAnswer().innerText(), /Qual é o principal resultado/);
    await assertGroundedSource('goal_presence');
    assert.equal(phpCounts().spawned, 1);
    await sendText('Quero captar leads interessados.');
    assert.match(await lastAnswer().innerText(), /Quem você deseja alcançar/);
    await sendText('Quero alcançar outras empresas e consumidores online.');
    assert.match(await lastAnswer().innerText(), /mais de uma interpretação possível/);
    assert.equal(phpCounts().spawned, 1, 'Ambiguous field answers stay local.');
    await choose('r08:audience:businesses');
    assert.match(await lastAnswer().innerText(), /Como estão os textos e as imagens/);
    await sendText('Já tenho textos e imagens.');
    assert.match(await lastAnswer().innerText(), /previsão para iniciar/);
    await sendText('Quero iniciar nos próximos 30 dias.');
    assert.match(await lastAnswer().innerText(), /autoriza que a equipe Imagine entre em contato/);
    await sendText('Sim, autorizo.');
    assert.match(await lastAnswer().innerText(), /RASCUNHO NÃO ENVIADO/);
    const summary = await page.locator('#faisca-summary-text').inputValue();
    assert.match(summary, /Site Onepage/);
    assert.match(summary, /Captar contatos/);
    assert.match(summary, /Outras empresas/);
    assert.match(summary, /Textos e imagens disponíveis/);
    assert.match(summary, /Até 30 dias/);
    assert.ok(summary.includes('Sim, autorizou (nenhum contato foi enviado)'));
    assert.match(summary, /Nenhum dado de contato foi coletado/);
    assert.doesNotMatch(summary, /@|[0-9]{10,}/);
    assert.equal(phpCounts().spawned, 1, 'R08 choices and consent must not create PHP work.');
    executedPHP = true;
  });

  await check('R08 questions during qualification use the real PHP passage while preserving the next qualification state', async () => {
    const before = await assistantCount();
    await page.locator('#faisca-input').fill('Como funciona o projeto?');
    await page.locator('#faisca-send').click();
    await waitUnknown();
    await eventually(() => phpCounts().spawned === 2, 'The R07 process passage must start real PHP.');
    await eventually(() => phpCounts().completed === 2, 'The real PHP process must finish before reconciliation.', 5000);
    await reconcileUi();
    assert.equal(await assistantCount(), before + 1);
    await assertGroundedSource('process');
    assert.match(await lastAnswer().innerText(), /RASCUNHO NÃO ENVIADO/);
    assert.match(await lastAnswer().innerText(), /Autorização para contato futuro/);
    assert.equal(phpCounts().spawned, 2);
    executedPHP = true;
  });

  await check('R08 explicit correction clears dependent fields and never leaks a previous consent', async () => {
    await choose('r08:edit:audience');
    assert.match(await lastAnswer().innerText(), /Quem você deseja alcançar/);
    await choose('r08:audience:businesses');
    await choose('r08:materials:need_support');
    await choose('r08:timeline:flexible');
    await choose('r08:contactConsent:declined');
    const summary = await page.locator('#faisca-summary-text').inputValue();
    assert.match(summary, /Outras empresas/);
    assert.match(summary, /Precisa de apoio com o conteúdo/);
    assert.match(summary, /Sem prazo definido/);
    assert.match(summary, /Não concedida/);
    assert.doesNotMatch(summary, /Sim, autorizou/);
    assert.equal(phpCounts().spawned, 2);
  });

  await check('R08 two independent HTTP sessions can confirm different services using the same message ID', async () => {
    const [sessionA, sessionB] = await Promise.all([
      browserFetch(page, endpoints.sessions, 'POST', {}, null),
      browserFetch(page, endpoints.sessions, 'POST', {}, null)
    ]);
    assert.equal(sessionA.status, 201); assert.equal(sessionB.status, 201);
    const a = sessionA.data, b = sessionB.data;
    assert.notEqual(a.conversationId, b.conversationId);
    const proposalA = await browserFetch(page, endpoints.messages, 'POST', {
      schema: CONVERSATION_SCHEMA, conversationId: a.conversationId, messageId: 'r08_proposal_A_0001',
      locale: 'pt-BR', input: { type: 'text', text: 'Quero apresentar minha empresa.' }
    }, a.token);
    const proposalB = await browserFetch(page, endpoints.messages, 'POST', {
      schema: CONVERSATION_SCHEMA, conversationId: b.conversationId, messageId: 'r08_proposal_B_0001',
      locale: 'pt-BR', input: { type: 'text', text: 'Preciso captar contatos para uma oferta.' }
    }, b.token);
    assert.equal(proposalA.data.status, 'answered'); assert.equal(proposalB.data.status, 'answered');
    const sharedMessageId = 'r08_shared_confirm_0001';
    const before = phpCounts();
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
    await eventually(() => phpCounts().spawned === before.spawned + 2, 'Both R08 sessions must dispatch independent PHP children.');
    await eventually(() => phpCounts().completed === before.completed + 2, 'Both R08 PHP children must complete.', 5000);
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
    assert.match(answerA.data.response.text, /Site Onepage/);
    assert.match(answerA.data.response.text, /Qual é o principal resultado/);
    assert.match(answerB.data.response.text, /Landing Page/);
    assert.match(answerB.data.response.text, /Qual é o principal resultado/);
    assert.notDeepEqual(answerA.data.response.sources, answerB.data.response.sources);
    const wrongContext = await browserFetch(page, endpoints.reconcile, 'POST', {
      schema: CONVERSATION_SCHEMA, conversationId: b.conversationId, messageId: sharedMessageId,
      locale: 'pt-BR', input: { type: 'action', id: 'confirm_goal' }
    }, a.token);
    assert.equal(wrongContext.status, 403, 'An R08 token cannot consult another qualification session.');
    await Promise.all([a, b].map(session => browserFetch(page, endpoints.session, 'DELETE', {}, session.token)));
    await eventually(() => server.inspect().sessions === 1, 'Raw R08 sessions must be deleted while the browser session remains.');
    assert.equal(phpCounts().spawned, before.spawned + 2);
    assert.equal(phpCounts().completed, before.completed + 2);
    executedPHP = true;
  });

  await check('R08 reset during PHP work destroys its HTTP session and discards late delivery', async () => {
    const before = await assistantCount();
    await page.locator('#faisca-input').fill('Como funciona o projeto?');
    await page.locator('#faisca-send').click();
    await waitUnknown();
    await eventually(() => phpCounts().spawned === 5, 'The R08 PHP process must start before reset.');
    assert.equal(await assistantCount(), before);
    await page.locator('#faisca-reset').click();
    await eventually(() => server.inspect().sessions === 0, 'R08 reset must release the server-issued session.');
    await eventually(() => phpCounts().pending === 0, 'R08 reset must terminate the owned PHP child.');
    expectedResetTerminations++;
    await eventually(() => server.inspect().inflight === 0, 'R08 reset must drain HTTP handlers.');
    assert.equal(phpCounts().spawned, 5);
    assert.equal(await reconcileButton.isEnabled(), false);
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Objetivo ainda não selecionado|Nenhuma solução selecionada/);
    await wait(150);
    assert.equal(await assistantCount(), 1);
  });

  await check('R08 browser is accessible and makes no external request or browser persistence', async () => {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(item => item.id), [], 'R08 HTTP accessibility at ' + width + 'px');
    }
    assert.deepEqual(unexpected, []);
    assert.deepEqual(runtimeErrors, []);
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie })),
      { local: 0, session: 0, cookie: '' });
    assert.equal(executedPHP, true, 'R08 HTTP/PHP gate requires observed real PHP execution.');
    assert.equal(phpCounts().pending, 0, 'No PHP child may remain pending.');
    assert.equal(phpCounts().failed, expectedResetTerminations, 'Only the intentionally reset PHP child may be terminated.');
    assert.equal(server.inspect().sessions, 0);
    assert.equal(server.inspect().inflight, 0);
  });

} catch (error) {
  fatal = { phase: 'R08_HTTP_BROWSER', code: error?.code ?? 'qa_failure', message: error.message };
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await bridge?.close().catch(() => {});
  if (bridge) {
    await eventually(() => bridgeCounts(bridge).pending === 0, 'R08 left a real PHP process pending.', 5000).catch(() => {});
  }
  await mkdir(reports, { recursive: true });
  await writeFile(resolve(reports, 'Faisca_R08_HTTP_BROWSER_QA.json'), JSON.stringify({
    status: fatal ? 'failed' : 'passed', executedPHP,
    agentsCommit: configuration?.pin.commit ?? null,
    knowledgeVersion: configuration?.pin.knowledgeVersion ?? null,
    knowledgeDigest: configuration?.pin.knowledgeDigest ?? null,
    scope: 'Synthetic Chromium -> loopback HTTP -> server-scoped R08 qualification -> pinned PHP Agents; no external model or operational effects',
    php: bridge ? bridgeCounts(bridge) : null,
    server: server ? server.inspect() : null,
    expectedResetTerminations,
    unexpectedPHPFailures: bridge ? Math.max(0, bridgeCounts(bridge).failed - expectedResetTerminations) : null,
    results, unexpected, runtimeErrors, httpFailures, fatal
  }, null, 2) + '\n');
  console.log('R08 HTTP/PHP browser: ' + results.filter(item => item.status === 'pass').length + '/' + results.length +
    ' passed; executedPHP=' + executedPHP + '.');
  if (httpFailures.length) console.error('R08 HTTP error responses: ' + JSON.stringify(httpFailures));
  if (fatal) console.error(fatal.phase + ': ' + fatal.code + ': ' + fatal.message);
}
