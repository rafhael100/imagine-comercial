import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startReviewServer } from './static-server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../output');
let server, browser, context;
const unexpected = [], pageErrors = [];
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  process.stdout.write('PASS R22 ' + name + '\n');
}
try {
  server = await startReviewServer({ rootDir: root, enabled: '1', port: 0 });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ?
      { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {})
  });
  context = await browser.newContext({ viewport: { width: 390, height: 840 } });
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== server.origin || req.method() !== 'GET' ||
        !['/', '/journey/', '/support/'].includes(url.pathname) &&
        !/^\/_astro\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(url.pathname)) {
      unexpected.push(url.pathname);
      await route.abort();
    } else {
      await route.continue();
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  const last = () => page.locator('#faisca-log .assistant .message-body').last();
  async function nextReply(perform) {
    const before = await page.locator('#faisca-log .assistant').last().elementHandle();
    await perform();
    await page.waitForFunction(previous => {
      const log = document.querySelector('#faisca-log');
      const current = [...(log?.querySelectorAll('.assistant') ?? [])].at(-1);
      return log?.getAttribute('aria-busy') === 'false' && current && current !== previous;
    }, before, { timeout: 10000 });
  }
  const choose = id => nextReply(() =>
    page.locator('#faisca-quick-actions [data-action-id="' + id + '"]').click());
  const send = text => nextReply(async () => {
    await page.locator('#faisca-input').fill(text);
    await page.locator('#faisca-send').click();
  });

  await check('local qualification is opt-in and does not need HTTP or PHP', async () => {
    await page.goto(server.origin + '/journey/', { waitUntil: 'load' });
    await page.locator('[data-journey-start]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    await page.locator('[data-journey-start]').click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-faisca-root]').getAttribute('data-faisca-mode'), 'r08_local_qualification');
    assert.equal(await page.locator('#faisca-master').evaluate(img =>
      img.complete && img.naturalWidth === 1254), true);
  });

  await check('R20 preview qualifies Onepage, advises comparison and never opens checkout', async () => {
    await send('Quero Onepage.');
    assert.match(await last().innerText(), /Confirme a escolha/);
    await choose('confirm_goal');
    for (const id of ['r08:objective:capture_leads', 'r08:audience:businesses',
      'r08:materials:ready', 'r08:timeline:within_30_days',
      'r08:contactConsent:declined']) {
      await choose(id);
    }
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /RASCUNHO NÃO ENVIADO/);
    await choose('r08:next_steps');
    assert.match(await last().innerText(), /Como avançar com Site Onepage/);
    assert.match(await last().innerText(), /comparar também com Landing Page/i);
    assert.match(await last().innerText(), /contratação pública ainda não está disponível/i);
    assert.equal(await page.locator('#faisca-quick-actions [data-action-id="compare_sites"]').count(), 1);
    await choose('compare_sites');
    assert.match(await last().innerText(), /RASCUNHO NÃO ENVIADO/);
    assert.equal(await page.locator('#faisca-log .assistant').last()
      .locator('details.message-sources').count(), 1);
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
  });

  await check('anonymous support remains local, closed and copy-only', async () => {
    await page.goto(server.origin + '/support/', { waitUntil: 'load' });
    await page.locator('[data-support-start]').click();
    await page.locator('[data-faisca-root][data-faisca-mounted="true"]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-input').isDisabled(), true);
    await choose('after_sales');
    await choose('r10:topic:technical');
    await choose('r10:service:onepage');
    await choose('r10:detail:contact_form');
    assert.match(await page.locator('#faisca-summary-text').inputValue(), /Nenhum ticket foi aberto/);
    const beforeCount = await page.locator('#faisca-log .assistant').count();
    const beforeSummary = await page.locator('#faisca-summary-text').inputValue();
    await page.evaluate(() => {
      document.querySelector('#faisca-input').value = 'EXEMPLO-SINTETICO-123';
      document.querySelector('#faisca-composer').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(await page.locator('#faisca-input').inputValue(), '');
    assert.equal(await page.locator('#faisca-log .assistant').count(), beforeCount);
    assert.equal(await page.locator('#faisca-summary-text').inputValue(), beforeSummary);
    assert.doesNotMatch(await page.locator('#faisca-log').innerText(), /EXEMPLO-SINTETICO-123/);
  });

  await check('launcher never calls external services or stores browser data', async () => {
    assert.deepEqual(unexpected, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({
      local: localStorage.length, session: sessionStorage.length, cookie: document.cookie
    })), { local: 0, session: 0, cookie: '' });
    assert.equal((await page.request.post(server.origin + '/__faisca_lab/messages')).status(), 405);
    assert.equal((await page.request.get(server.origin + '/journey-http-r08/')).status(), 404);
  });
  process.stdout.write('R22 private review browser: ' + checks.length + '/' + checks.length +
    ' passed, no external services.\n');
} catch (error) {
  process.exitCode = 1;
  process.stderr.write('R22 private review failed: ' + error.message + '\n');
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
