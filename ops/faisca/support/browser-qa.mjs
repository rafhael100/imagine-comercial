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
const results = [], blocked = [], errors = [];
let server, browser, fatal;

async function check(name, action) {
  try { await action(); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); throw error; }
}

try {
  const files = new Map();
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile()) files.set('/' + relative(output, path).split(sep).join('/'), await readFile(path));
      else throw new Error('Non-regular laboratory output.');
    }
  }
  await collect(output);
  console.log('R10 static laboratory snapshot: ' + files.size + ' files, ' +
    [...files.values()].reduce((sum, item) => sum + item.length, 0) + ' bytes.');
  assert.ok(files.has('/support/index.html'), 'Build isolated R10 support lab first.');
  assert.deepEqual([...files.keys()].filter(path => path.endsWith('.html')).sort(), [
    '/grounded/index.html', '/http/index.html', '/index.html',
    '/journey-http-r08/index.html', '/journey-http/index.html',
    '/journey/index.html', '/support/index.html'
  ]);
  server = createServer((req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url;
    if (req.method !== 'GET' || typeof path !== 'string' || !files.has(path)) {
      res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end(); return;
    }
    const mime = path.endsWith('.js') ? 'text/javascript; charset=utf-8' :
      path.endsWith('.css') ? 'text/css; charset=utf-8' :
      path.endsWith('.png') ? 'image/png' :
      path.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
    res.end(files.get(path));
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen); server.listen(0, '127.0.0.1', resolveListen);
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin || url.search || !files.has(url.pathname)) {
      blocked.push({ method: request.method(), path: url.pathname });
      await route.abort(); return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/support/index.html', { waitUntil: 'load' });
  const last = () => page.locator('#faisca-log .assistant .message-body').last();
  const summary = () => page.locator('#faisca-summary-text').inputValue();
  async function done(before) {
    await page.waitForFunction(count => {
      const log = document.querySelector('#faisca-log');
      return log && log.getAttribute('aria-busy') === 'false' &&
        log.querySelectorAll('.assistant').length === count + 1;
    }, before, { timeout: 10000 });
  }
  async function choose(id) {
    const before = await page.locator('#faisca-log .assistant').count();
    await page.locator('#faisca-quick-actions [data-action-id="' + id + '"]').click();
    await done(before);
  }
  async function typeText(text) {
    const before = await page.locator('#faisca-log .assistant').count();
    await page.locator('#faisca-input').fill(text);
    await page.locator('#faisca-send').click();
    await done(before);
  }

  await check('R10 support lab requires explicit activation and keeps the approved artwork', async () => {
    const start = page.locator('[data-support-start]');
    await start.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-log .assistant').count(), 0);
    assert.equal(await page.locator('#faisca-master').evaluate(image =>
      image.complete && image.naturalWidth === 1254), true);
    await start.click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-faisca-root]').getAttribute('data-faisca-mode'),
      'r10_anonymous_support_lab');
  });

  await check('R10 support mode asks a closed topic, service and detail before a copy-only summary', async () => {
    await choose('after_sales');
    assert.match(await last().innerText(), /Qual é o assunto/);
    await choose('r10:topic:technical');
    assert.match(await last().innerText(), /A qual serviço/);
    await choose('r10:service:onepage');
    assert.match(await last().innerText(), /Qual destas opções/);
    await choose('r10:detail:contact_form');
    assert.match(await last().innerText(), /RESUMO DE SUPORTE/);
    assert.match(await summary(), /Site Onepage/);
    assert.match(await summary(), /Dificuldade com formulário/);
    assert.match(await summary(), /Nenhum ticket foi aberto/);
    assert.match(await summary(), /não verificado/);
    assert.equal(await page.locator('#faisca-log .assistant').last().locator('.message-sources').count(), 0);
  });

  await check('R10 revision clears dependent fields without creating any ticket', async () => {
    await choose('r10:revise:service');
    assert.match(await last().innerText(), /A qual serviço/);
    assert.doesNotMatch(await summary(), /Dificuldade com formulário/);
    await choose('r10:service:landing-page');
    await choose('r10:detail:site_unavailable');
    assert.match(await summary(), /Landing Page/);
    assert.match(await summary(), /Página não abre/);
    assert.doesNotMatch(await summary(), /Site Onepage|Dificuldade com formulário/);
    assert.match(await summary(), /Nenhum ticket foi aberto/);
  });

  await check('R10 never echoes typed credentials, phone numbers or email into the chat or summary', async () => {
    const before = await summary();
    await typeText('Minha senha SYNTHETIC_SECRET_999 e email secret@example.invalid');
    assert.match(await last().innerText(), /aceita apenas as opções disponíveis/);
    const log = await page.locator('#faisca-log').innerText();
    assert.doesNotMatch(log, /SYNTHETIC_SECRET_999|secret@example.invalid/);
    assert.doesNotMatch(await summary(), /SYNTHETIC_SECRET_999|secret@example.invalid/);
    assert.equal(await summary(), before);
  });

  await check('R10 reset erases the local triage and does not claim a support ticket', async () => {
    await page.locator('#faisca-reset').click();
    assert.equal(await page.locator('#faisca-log .assistant').count(), 1);
    assert.doesNotMatch(await summary(), /Site Onepage|Landing Page|Página não abre/);
    assert.match(await summary(), /Nenhum ticket foi aberto/);
  });

  await check('R10 screen remains responsive and accessible at 320, 390 and 1440 pixels', async () => {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(item => item.id), [], 'Accessibility at ' + width + 'px');
    }
  });

  await check('R10 creates no external traffic, browser persistence or runtime errors', async () => {
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() =>
      ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie })),
      { local: 0, session: 0, cookie: '' });
  });
  await context.close();
} catch (error) {
  fatal = { name: error?.name ?? 'R10_BROWSER', code: error?.code ?? 'qa_failure',
    message: error?.message ?? 'Unknown error' };
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await new Promise(resolveClose => server ? server.close(resolveClose) : resolveClose());
  await mkdir(reportDir, { recursive: true });
  await writeFile(resolve(reportDir, 'Faisca_R10_SUPPORT_BROWSER_QA.json'), JSON.stringify({
    status: fatal ? 'failed' : 'passed',
    scope: 'R10 anonymous local-only support triage with approved artwork and copy-only brief',
    scenarios: results, blocked, errors, fatal,
    operationalEffects: false, ticketCreated: false, externalModelInvocations: 0
  }, null, 2) + '\n');
  console.log('R10 support browser: ' + results.filter(item => item.status === 'pass').length +
    '/' + results.length + ' passed.');
  if (fatal) console.error(fatal.name + ': ' + fatal.message);
}
