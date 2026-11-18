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
  assert.equal([...files.keys()].filter(path => path.endsWith('.html')).length, 1);
  const uiFiles = [...files.keys()].filter(path => /\/_astro\/ui\.[^/]+\.js$/.test(path));
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
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const allowed = url.origin === origin && !url.search && request.method() === 'GET' &&
      (url.pathname === '/' || files.has(url.pathname));
    if (!allowed) { unexpected.push(request.url()); await route.abort(); return; }
    requests.push(url.pathname);
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto(origin, { waitUntil: 'load' });
  await check('Astro view starts with static guidance and deferred conversation code', async () => {
    await page.locator('[data-faisca-lab-start]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.chat-message').count(), 0);
    assert.equal(requests.includes(uiFiles[0]), false);
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-master').evaluate(img => img.complete && img.naturalWidth === 1254), true);
  });
  await check('activation loads the conversation once and handles a real guided turn', async () => {
    await page.locator('[data-faisca-lab-start]').click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(requests.filter(path => path === uiFiles[0]).length, 1);
    assert.equal(await page.locator('.chat-message').count(), 1);
    await page.locator('#faisca-input').fill('Qual a diferença entre Onepage e Landing Page?');
    await page.locator('#faisca-send').click();
    await page.waitForFunction(() => document.querySelector('#faisca-log').getAttribute('aria-busy') === 'false');
    assert.match(await page.locator('#faisca-log .assistant .message-body').last().innerText(), /Onepage/);
  });
  await check('custom-element disconnect and reconnect starts a clean conversation', async () => {
    await page.evaluate(() => {
      const host = document.querySelector('faisca-lab');
      const parent = host.parentElement;
      host.remove(); parent.append(host);
    });
    await page.locator('[data-faisca-lab-start]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.chat-message').count(), 0);
    await page.locator('[data-faisca-lab-start]').click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.chat-message').count(), 1);
    assert.equal(requests.filter(path => path === uiFiles[0]).length, 1);
  });
  await check('Astro view fits the three target widths and passes axe', async () => {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(axe.violations, [], `axe at ${width}`);
    }
  });
  await check('Astro guidance remains available without JavaScript', async () => {
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJS.newPage();
    await staticPage.goto(origin, { waitUntil: 'load' });
    assert.equal(await staticPage.locator('#hero-title').isVisible(), true);
    assert.equal(await staticPage.locator('[data-faisca-lab-start]').isVisible(), false);
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
