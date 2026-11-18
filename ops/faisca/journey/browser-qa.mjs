import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = dirname(fileURLToPath(import.meta.url));
const output = resolve(base, '../output/astro');
const reportDir = resolve(base, '../reports');
const outcomes = [];
const blocked = [];
const errors = [];
let server, browser, fatal;
const check = async (name, fn) => {
  try { await fn(); outcomes.push({ name, status: 'pass' }); console.log('PASS ' + name); }
  catch (error) { outcomes.push({ name, status: 'fail', error: error.message }); throw error; }
};

try {
  const files = new Map();
  async function collect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile()) files.set('/' + relative(output, path).split(sep).join('/'), await readFile(path));
      else throw new Error('Non-regular laboratory output.');
    }
  }
  await collect(output);
  assert.ok(files.has('/journey/index.html'), 'Build the isolated Astro R07 route first.');
  server = createServer((req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url;
    if (req.method !== 'GET' || !files.has(path)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      'Content-Type': path.endsWith('.js') ? 'text/javascript; charset=utf-8'
        : path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    });
    res.end(files.get(path));
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin || url.search || !files.has(url.pathname)) {
      blocked.push(request.url()); await route.abort(); return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/journey/index.html', { waitUntil: 'load' });
  const last = () => page.locator('#faisca-log .assistant .message-body').last();
  async function done(previous) {
    await page.waitForFunction(count => {
      const root = document.querySelector('#faisca-log');
      return root && root.getAttribute('aria-busy') === 'false' &&
        root.querySelectorAll('.assistant').length === count + 1;
    }, previous, { timeout: 8000 });
  }
  async function send(message) {
    const previous = await page.locator('#faisca-log .assistant').count();
    await page.locator('#faisca-input').fill(message);
    await page.locator('#faisca-send').click();
    await done(previous);
  }
  async function choose(id) {
    const previous = await page.locator('#faisca-log .assistant').count();
    await page.locator('#faisca-quick-actions [data-action-id="' + id + '"]').click();
    await done(previous);
  }
  await check('R07 does not activate or issue a request before explicit user activation', async () => {
    const button = page.locator('[data-journey-start]');
    await button.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-log .assistant').count(), 0);
    assert.equal(await page.locator('#faisca-master').evaluate(img => img.complete && img.naturalWidth === 1254), true);
    await button.click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-faisca-root]').getAttribute('data-faisca-mode'), 'r08_local_qualification');
  });
  await check('R07 visible proposal requires confirmation and does not overwrite the current summary', async () => {
    await send('Quero Onepage.');
    assert.match(await last().innerText(), /Confirme a escolha/);
    assert.doesNotMatch(await page.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
    await choose('confirm_goal');
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
    assert.equal(await page.locator('#faisca-log .assistant').last().locator('.message-sources').count(), 1);
  });
  await check('R07 correction is proposed, confirmed and reflected exactly once in summary', async () => {
    await send('Na verdade prefiro Landing Page.');
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
    await choose('confirm_goal');
    const summary = await page.locator('#faisca-summary-text').inputValue();
    assert.match(summary, /Landing Page/);
    assert.doesNotMatch(summary, /Site Onepage/);
  });
  await check('R07 unsupported and comparative questions keep the selected solution', async () => {
    await send('O site inclui e-mail?');
    assert.match(await last().innerText(), /Não encontrei/);
    await send('Qual a diferença entre Onepage e Landing Page?');
    assert.equal(await page.locator('#faisca-log .assistant').last().locator('.message-sources').count(), 1);
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Landing Page/);
  });
  await check('R07 local sensitive preflight prevents credential echo and preserves selection', async () => {
    await send('Minha senha TEST_SECRET_555');
    assert.doesNotMatch(await page.locator('#faisca-log').innerText(), /TEST_SECRET_555/);
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Landing Page/);
  });
  await check('R07 reset discards previous summary and active confirmation', async () => {
    await send('Quero Onepage.');
    await page.locator('#faisca-reset').click();
    assert.doesNotMatch(await page.locator('#faisca-summary-text').inputValue(), /Landing Page|Site Onepage/);
    assert.equal(await page.locator('#faisca-log .assistant').count(), 1);
    await send('resumo');
    assert.match(await last().innerText(), /Objetivo ainda não selecionado/);
  });
  for (const width of [320, 390, 1440]) {
    await check('R07 responsive accessible controls at ' + width + 'px', async () => {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('#faisca-send').isVisible(), true);
      const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;
      assert.deepEqual(violations.map(v => v.id), [], JSON.stringify(violations.map(v => ({ id: v.id, impact: v.impact }))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    });
  }
  await check('R08 qualifies the confirmed Onepage through explicit one-at-a-time choices', async () => {
    await send('Quero Onepage.');
    await choose('confirm_goal');
    assert.match(await last().innerText(), /Qual é o principal resultado/);
    await choose('r08:objective:present_company');
    assert.match(await last().innerText(), /Quem você deseja alcançar/);
    await choose('r08:audience:local_customers');
    assert.match(await last().innerText(), /Como estão os textos e as imagens/);
    await choose('r08:materials:ready');
    assert.match(await last().innerText(), /previsão para iniciar/);
    await choose('r08:timeline:within_30_days');
    assert.match(await last().innerText(), /autoriza que a equipe Imagine entre em contato/);
    await choose('r08:contactConsent:granted');
    const summary = await page.locator('#faisca-summary-text').inputValue();
    assert.match(summary, /Site Onepage/);
    assert.match(summary, /Apresentar a empresa/);
    assert.match(summary, /Clientes da região/);
    assert.match(summary, /Textos e imagens disponíveis/);
    assert.match(summary, /Até 30 dias/);
    assert.match(summary, /Autorização declarada, ainda não enviada/);
    assert.match(summary, /RASCUNHO NÃO ENVIADO/);
    assert.doesNotMatch(summary, /@|\b\d{10,}\b/);
  });
  await check('R08 explicit correction resets only dependent answers and requires renewed contact choice', async () => {
    await choose('r08:edit:audience');
    assert.match(await last().innerText(), /Quem você deseja alcançar/);
    await choose('r08:audience:businesses');
    await choose('r08:materials:need_support');
    await choose('r08:timeline:flexible');
    await choose('r08:contactConsent:declined');
    const summary = await page.locator('#faisca-summary-text').inputValue();
    assert.match(summary, /Apresentar a empresa/);
    assert.match(summary, /Outras empresas/);
    assert.match(summary, /Precisa de apoio com o conteúdo/);
    assert.match(summary, /Sem prazo definido/);
    assert.match(summary, /Não concedida/);
    assert.doesNotMatch(summary, /Autorização declarada/);
  });
  await check('R07 browser makes no external requests, persistence or script execution errors', async () => {
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal(await page.evaluate(() => document.cookie), '');
  });
  await context.close();
} catch (error) {
  fatal = error;
} finally {
  await browser?.close().catch(() => {});
  await new Promise(resolveClose => server ? server.close(resolveClose) : resolveClose());
  await mkdir(reportDir, { recursive: true });
  await writeFile(resolve(reportDir, 'browser-R08.json'), JSON.stringify({
    status: fatal ? 'failed' : 'passed', scenarios: outcomes, blockedCount: blocked.length,
    runtimeErrors: errors, externalModelInvocations: 0, visitorData: 'synthetic_only'
  }, null, 2) + '\n');
}
if (fatal) {
  console.error(fatal.stack || fatal.message);
  process.exitCode = 1;
} else {
  console.log('R08 local journey browser: ' + outcomes.length + '/' + outcomes.length + ' passed.');
}
