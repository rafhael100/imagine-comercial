import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// Run only against the separate static laboratory build, never a remote site.
const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, '../output/astro');
const reports = resolve(root, '../reports');
const results = [];
const unexpected = [];
const runtimeErrors = [];
let browser, server, phase = 'read_build', fatal;
async function check(name, run) {
  try { await run(); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); throw error; }
}

try {
  const files = new Map();
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile()) files.set('/' + relative(output, path).split(sep).join('/'), await readFile(path));
      else throw new Error('Unexpected non-regular laboratory output.');
    }
  }
  await collect(output);
  assert.ok(files.has('/index.html'), 'build the isolated Astro laboratory first');
  assert.deepEqual([...files.keys()].filter(path => path.endsWith('.html')).sort(),
    ['/grounded/index.html', '/http/index.html', '/index.html', '/journey-http-r08/index.html', '/journey-http/index.html', '/journey/index.html'], 'the build contains exactly the six reviewed laboratory pages');
  const uiFiles = [...files.keys()].filter(path => /\/_astro\/conversation-ui\.[^/]+\.js$/.test(path));
  assert.equal(uiFiles.length, 1, 'conversation has a separate lazy-loaded module');
  phase = 'server_start';
  server = createServer((request, response) => {
    const path = request.url === '/' ? '/index.html' : request.url;
    if (request.method !== 'GET' || !files.has(path)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {
      'Content-Type': path.endsWith('.js') ? 'text/javascript; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow'
    });
    response.end(files.get(path));
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  phase = 'browser_launch';
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  phase = 'checks';
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const requests = [];
  const restrictToLocalBuild = target => target.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const allowed = url.origin === origin && !url.search && request.method() === 'GET' &&
      (url.pathname === '/' || files.has(url.pathname));
    if (!allowed) { unexpected.push(request.url()); await route.abort(); return; }
    requests.push(url.pathname);
    await route.continue();
  });
  await restrictToLocalBuild(context);
  const page = await context.newPage();
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto(origin, { waitUntil: 'load' });
  const conversation = page.locator('[data-faisca-root]');
  const scenario = page.locator('[data-faisca-lab-scenario]');
  const start = page.locator('[data-faisca-lab-start]');
  const lastAnswer = () => page.locator('#faisca-log .assistant .message-body').last();
  async function waitForAnswer(previousCount) {
    await page.waitForFunction(count => {
      const log = document.querySelector('#faisca-log');
      return log.getAttribute('aria-busy') === 'false' && log.querySelectorAll('.assistant').length === count + 1;
    }, previousCount);
  }
  async function send(text) {
    const previousCount = await page.locator('#faisca-log .assistant').count();
    await page.locator('#faisca-input').fill(text);
    await page.locator('#faisca-send').click();
    await waitForAnswer(previousCount);
  }
  async function choose(id) {
    const previousCount = await page.locator('#faisca-log .assistant').count();
    await page.locator(`#faisca-quick-actions [data-action-id="${id}"]`).click();
    await waitForAnswer(previousCount);
  }
  async function activateScenario(value) {
    if (await scenario.inputValue() !== value) {
      await scenario.selectOption(value);
      await start.waitFor({ state: 'visible' });
      assert.equal(await page.locator('.chat-message').count(), 0, 'changing a scenario destroys the previous conversation');
      assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    } else if (!await start.isVisible()) {
      await page.locator('#faisca-reset').click();
    }
    if (await start.isVisible()) await start.click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await conversation.getAttribute('data-faisca-mode'), 'simulated_contract_demo');
    assert.equal(await page.locator('.chat-message').count(), 1);
    assert.match(await page.locator('[data-faisca-lab-status]').innerText(), /simulado/i);
  }
  async function assertOutcome(status, delivery) {
    assert.equal(await conversation.getAttribute('data-faisca-status'), status);
    assert.equal(await conversation.getAttribute('data-faisca-delivery'), delivery);
  }
  // Wait beyond the simulated provider's 800 ms delivery to expose stale callbacks.
  const settleLateProvider = () => page.waitForTimeout(1000);
  await check('Astro view starts with static guidance and deferred conversation code', async () => {
    await start.waitFor({ state: 'visible' });
    assert.equal(await scenario.isVisible(), true);
    assert.equal(await page.locator('.chat-message').count(), 0);
    assert.equal(requests.includes(uiFiles[0]), false);
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-master').evaluate(img => img.complete && img.naturalWidth === 1254), true);
  });
  await check('activation loads the simulated contract once and handles a guided turn', async () => {
    await activateScenario('success');
    assert.equal(requests.filter(path => path === uiFiles[0]).length, 1);
    await send('Qual a diferença entre Onepage e Landing Page?');
    await assertOutcome('answered', 'simulated');
    assert.match(await lastAnswer().innerText(), /Onepage/);
    assert.equal(await page.locator('#faisca-log .assistant').last().locator('.message-sources').count(), 1);
  });
  await check('simulated conversation keeps qualification and curated summary coherent across turns', async () => {
    await activateScenario('success');
    await choose('sell');
    await choose('goal_presence');
    await choose('materials_ready');
    await choose('summary');
    await assertOutcome('answered', 'simulated');
    const summary = await page.locator('#faisca-summary-text').inputValue();
    assert.match(summary, /Site Onepage/);
    assert.match(summary, /textos e imagens já disponíveis/);
    assert.match(summary, /não foi enviado à equipe/i);
  });
  for (const [value, expectedStatus, explanation] of [
    ['unavailable', 'unavailable', /indisponível/i],
    ['limit', 'provider_limit', /limite/i],
    ['malformed', 'invalid_response', /validação/i]
  ]) {
    await check(`${value} provider returns an explicit guided fallback without executing its content`, async () => {
      await activateScenario(value);
      await send('Qual a diferença entre Onepage e Landing Page?');
      await assertOutcome(expectedStatus, 'guided_fallback');
      const text = await lastAnswer().innerText();
      assert.match(text, explanation);
      assert.match(text, /guiada local/);
      assert.match(text, /Onepage/);
      assert.equal(await page.locator('#faisca-log script, #faisca-log iframe, #faisca-log img, #faisca-log a').count(), 0);
      assert.equal(await page.locator('#faisca-send').isEnabled(), true);
    });
  }
  await check('a timeout stays uncertain and does not append a late provider answer automatically', async () => {
    await activateScenario('timeout');
    await send('Qual a diferença entre Onepage e Landing Page?');
    await assertOutcome('unknown', 'unknown');
    assert.match(await lastAnswer().innerText(), /ainda não confirmou/);
    assert.match(await lastAnswer().innerText(), /Nenhuma nova tentativa foi enviada/);
    const snapshot = await page.locator('#faisca-log').innerText();
    await settleLateProvider();
    assert.equal(await page.locator('#faisca-log').innerText(), snapshot);
    await assertOutcome('unknown', 'unknown');
  });
  await check('reset during a pending provider call discards the old response and outcome markers', async () => {
    await activateScenario('timeout');
    await page.locator('#faisca-input').fill('Quero organizar minhas vendas');
    await page.locator('#faisca-send').click();
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-busy'), 'true');
    await page.locator('#faisca-reset').click();
    assert.equal(await page.locator('.chat-message').count(), 1);
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-busy'), 'false');
    assert.equal(await conversation.getAttribute('data-faisca-status'), null);
    assert.equal(await conversation.getAttribute('data-faisca-delivery'), null);
    const snapshot = await page.locator('#faisca-log').innerText();
    await settleLateProvider();
    assert.equal(await page.locator('#faisca-log').innerText(), snapshot);
    assert.equal(await page.locator('.chat-message').count(), 1);
    assert.doesNotMatch(await page.locator('#faisca-summary-text').inputValue(), /Imagine CRM/);
  });
  await check('changing scenarios while pending cannot pollute the replacement conversation', async () => {
    await activateScenario('timeout');
    await page.locator('#faisca-input').fill('Quero organizar minhas vendas');
    await page.locator('#faisca-send').click();
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-busy'), 'true');
    await activateScenario('success');
    await send('Como funciona o investimento?');
    await assertOutcome('answered', 'simulated');
    assert.match(await lastAnswer().innerText(), /Portal/);
    const snapshot = await page.locator('#faisca-log').innerText();
    await settleLateProvider();
    assert.equal(await page.locator('#faisca-log').innerText(), snapshot);
    assert.equal(await page.locator('#faisca-log .user').count(), 1);
    assert.doesNotMatch(await page.locator('#faisca-summary-text').inputValue(), /Imagine CRM/);
  });
  await check('typing the next draft during an asynchronous answer preserves that draft', async () => {
    await activateScenario('timeout');
    const previousCount = await page.locator('#faisca-log .assistant').count();
    await page.locator('#faisca-input').fill('Como funciona o projeto?');
    await page.locator('#faisca-send').click();
    await page.locator('#faisca-input').fill('Esta é minha próxima pergunta');
    await waitForAnswer(previousCount);
    assert.equal(await page.locator('#faisca-input').inputValue(), 'Esta é minha próxima pergunta');
  });
  await check('hiding a pending conversation keeps announcements quiet and reopening restores focus', async () => {
    await activateScenario('timeout');
    await page.locator('#faisca-input').fill('Como funciona o projeto?');
    await page.locator('#faisca-input').press('Enter');
    await page.locator('#faisca-input').press('Escape');
    assert.equal(await page.locator('#faisca-chat').isVisible(), false);
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-live'), 'off');
    await settleLateProvider();
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-live'), 'off');
    await page.locator('#faisca-launcher').click();
    assert.equal(await page.locator('#faisca-log').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('#faisca-input').evaluate(element => element === document.activeElement), true);
  });
  await check('disconnect and reconnect cancels a pending view and starts a clean conversation', async () => {
    await activateScenario('timeout');
    await page.locator('#faisca-input').fill('Quero organizar minhas vendas');
    await page.locator('#faisca-send').click();
    await page.evaluate(() => {
      const host = document.querySelector('faisca-lab');
      const parent = host.parentElement;
      host.remove(); parent.append(host);
    });
    await start.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.chat-message').count(), 0);
    await start.click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.chat-message').count(), 1);
    const snapshot = await page.locator('#faisca-log').innerText();
    await settleLateProvider();
    assert.equal(await page.locator('#faisca-log').innerText(), snapshot);
    assert.equal(await conversation.getAttribute('data-faisca-status'), null);
    assert.equal(requests.filter(path => path === uiFiles[0]).length, 1);
  });
  await check('Astro view fits the three target widths and passes axe', async () => {
    await activateScenario('success');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(axe.violations, [], `axe at ${width}`);
    }
  });
  await check('Astro guidance remains available without JavaScript', async () => {
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    await restrictToLocalBuild(noJS);
    const staticPage = await noJS.newPage();
    staticPage.on('pageerror', error => runtimeErrors.push(error.message));
    await staticPage.goto(origin, { waitUntil: 'load' });
    assert.equal(await staticPage.locator('#hero-title').isVisible(), true);
    assert.equal(await staticPage.locator('[data-faisca-lab-start]').isVisible(), false);
    assert.equal(await staticPage.locator('[data-faisca-lab-scenario]').isVisible(), false);
    assert.equal(await staticPage.locator('#faisca-composer').isVisible(), false);
    assert.equal(await staticPage.locator('.no-script-note').isVisible(), true);
    await noJS.close();
  });
  await check('no messages, cookies, persistence or external requests are created', async () => {
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(unexpected, []);
    assert.deepEqual(runtimeErrors, []);
  });
  await context.close();
} catch (error) {
  fatal = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise(resolveClose => server.close(resolveClose));
  await mkdir(reports, { recursive: true });
  const report = {
    status: fatal ? (phase === 'browser_launch' ? 'blocked_environment' : 'failed') : 'passed',
    phase, browser: phase === 'checks' ? 'EXECUTED' : 'NOT_RUN',
    axe: results.some(item => item.name.includes('axe')) ? 'EXECUTED' : 'NOT_RUN',
    scope: 'Synthetic isolated Astro laboratory; no production authorization',
    results, unexpectedRequests: unexpected, runtimeErrors, fatal
  };
  await writeFile(resolve(reports, 'astro-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (fatal) console.error(fatal);
}
