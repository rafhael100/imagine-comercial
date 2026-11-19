import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startPrivateCommercialFaisca } from './commercial-preview.mjs';

const password = 'R27_SYNTHETIC_PRIVATE_PREVIEW_PASSWORD_123';
let server, browser;
const results = [], outbound = [];
const check = async (name, callback) => {
  await callback();
  results.push(name);
  process.stdout.write('PASS FAISCA R27 ' + name + '\n');
};

try {
  server = await startPrivateCommercialFaisca({ password });
  browser = await chromium.launch({ headless: true });

  await check('R27 without JavaScript: homepage CTAs, navigation and No-JS notice still work', async () => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      httpCredentials: { username: 'reviewer', password },
      viewport: { width: 320, height: 740 }
    });
    try {
      await context.route('**/*', route => {
        const origin = new URL(route.request().url()).origin;
        if (origin !== server.origin) { outbound.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(server.origin + '/', { waitUntil: 'load' });
      assert.equal(await page.locator('[data-faisca-private-entry]').count(), 1);
      assert.equal(await page.locator('#simular-compra[data-choice-preview]').count(), 1);
      assert.equal(await page.locator('[data-choice-site="onepage"]').getAttribute('aria-pressed'), 'true');
      const quote = page.locator('a[data-purchase-intent="site"]').first();
      await quote.click();
      assert.equal(new URL(page.url()).hash, '#simular-compra');
      assert.equal(new URL(page.url()).search, '');
      await page.locator('[data-faisca-private-inline] summary').click();
      const disclosure = page.locator('[data-faisca-private-inline]');
      assert.equal(await disclosure.getAttribute('open'), '');
      const embedded = page.frameLocator('iframe[data-faisca-inline-frame]');
      await embedded.locator('.no-script-note').waitFor({ state: 'visible', timeout: 15000 });
      assert.match(await embedded.locator('.no-script-note').innerText(), /Ative JavaScript/);
      assert.equal(await embedded.locator('#faisca-composer').isVisible(), false);
      assert.deepEqual(await context.cookies(), []);
      await page.goto(server.origin + '/servicos/', { waitUntil: 'load' });
      assert.equal(await page.locator('main#conteudo').count(), 1);
      assert.ok(await page.locator('h1').count() >= 1);
    } finally { await context.close(); }
  });

  await check('R27 failed Faísca bundle: site quote selector still updates on desktop', async () => {
    const context = await browser.newContext({
      httpCredentials: { username: 'reviewer', password },
      viewport: { width: 1440, height: 900 }
    });
    const blocked = [];
    try {
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== server.origin) {
          outbound.push(route.request().url());
          await route.abort();
          return;
        }
        if (/^\/_astro\/FaiscaJourneyLab\..+\.js$/.test(url.pathname)) {
          blocked.push(url.pathname);
          await route.abort('failed');
          return;
        }
        await route.continue();
      });
      const page = await context.newPage();
      await page.goto(server.origin + '/', { waitUntil: 'load' });
      const quote = page.locator('#simular-compra[data-choice-preview]');
      assert.equal(await quote.count(), 1);
      await quote.locator('[data-choice-site="landing-pages"]').click();
      assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await quote.locator('[data-choice-site="onepage"]').getAttribute('aria-pressed'), 'false');
      const disclosure = page.locator('[data-faisca-private-inline]');
      await disclosure.locator('summary').click();
      const embedded = page.frameLocator('iframe[data-faisca-inline-frame]');
      await embedded.locator('[data-faisca-root]').waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForFunction(() =>
        document.querySelector('iframe[data-faisca-inline-frame]')?.contentDocument?.readyState === 'complete');
      assert.ok(blocked.length >= 1, 'The reviewed Faísca script must actually be blocked in this negative test.');
      assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
      await disclosure.locator('summary').click();
      await quote.locator('[data-choice-site="onepage"]').click();
      assert.equal(await quote.locator('[data-choice-site="onepage"]').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await context.cookies(), []);
    } finally { await context.close(); }
  });

  await check('R27 keyboard disclosure works without activating any private checkout', async () => {
    const context = await browser.newContext({
      httpCredentials: { username: 'reviewer', password },
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce'
    });
    try {
      const page = await context.newPage();
      await page.goto(server.origin + '/', { waitUntil: 'load' });
      const summary = page.locator('[data-faisca-private-inline] summary');
      await summary.focus();
      await summary.press('Enter');
      assert.equal(await page.locator('[data-faisca-private-inline]').getAttribute('open'), '');
      await summary.press('Enter');
      assert.equal(await page.locator('[data-faisca-private-inline]').getAttribute('open'), null);
      assert.equal(await page.locator('#simular-compra form').count(), 0);
      assert.equal(await page.locator('[data-faisca-private-entry] input[type="email"]').count(), 0);
      assert.deepEqual(await context.cookies(), []);
    } finally { await context.close(); }
    assert.deepEqual(outbound, []);
  });

  process.stdout.write('FAISCA R27 graceful degradation: ' +
    results.length + '/' + results.length + ' passed.\n');
} catch (e) {
  process.exitCode = 1;
  process.stderr.write('FAISCA R27 degradation QA failed: ' + e.message + '\n');
} finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
