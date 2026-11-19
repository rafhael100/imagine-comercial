import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startPortablePrivateReview } from '../output/portable/iniciar-faisca-comercial.mjs';
import { verifyPortablePublicDist } from '../output/portable/portable-verify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../output/portable');
const password = 'R29_SYNTHETIC_LOCAL_REVIEW_PASSWORD_12345';
let server, browser, context;
const outgoing = [], errors = [], successful = [];
const check = async (name, fn) => {
  await fn();
  successful.push(name);
  process.stdout.write('PASS FAISCA R29 ' + name + '\n');
};
try {
  await check('extracted portable Comercial dist has exact SHA-256 manifest', async () => {
    const audited = await verifyPortablePublicDist({
      directory: resolve(root, 'dist'),
      manifestPath: resolve(root, 'Faisca_R29_DIST_SHA256.json')
    });
    assert.ok(audited.fileCount > 20);
    assert.equal(audited.publicFaiscaEnabled, false);
    assert.equal(audited.operationalEffects, false);
  });
  server = await startPortablePrivateReview({ folder: root, password });
  assert.match(server.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  await check('downloadable launcher restricts every static route behind Basic Auth', async () => {
    for (const url of ['/', '/servicos/', '/__faisca_preview/journey/',
      '/__faisca_preview/support/']) {
      const result = await fetch(server.origin + url, { redirect: 'manual' });
      assert.equal(result.status, 401);
      assert.match(result.headers.get('www-authenticate'), /Basic/i);
      assert.equal(result.headers.get('set-cookie'), null);
    }
    assert.equal((await fetch(server.origin + '/__faisca_lab/messages',
      { method: 'POST' })).status, 401);
  });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    httpCredentials: { username: 'reviewer', password },
    viewport: { width: 390, height: 840 }
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== server.origin || !['GET', 'HEAD'].includes(route.request().method())) {
      outgoing.push(route.request().url());
      await route.abort();
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await check('portable package actually displays Comercial, working CTA and inline Faísca', async () => {
    await page.goto(server.origin + '/', { waitUntil: 'load' });
    assert.equal(await page.locator('#simular-compra[data-choice-preview]').count(), 1);
    const choices = page.locator('#simular-compra');
    await choices.locator('[data-choice-site="none"]').click();
    const link = choices.locator('[data-choice-action]');
    assert.equal(await link.getAttribute('aria-disabled'), 'true');
    assert.equal(await link.evaluate(el =>
      el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))), false);
    await choices.locator('[data-choice-site="landing-pages"]').click();
    assert.equal(await link.getAttribute('aria-disabled'), 'false');
    const actionUrl = new URL(await link.getAttribute('href'));
    assert.equal(actionUrl.origin, 'https://wa.me');
    assert.equal(actionUrl.pathname, '/5585996632689');
    const details = page.locator('[data-faisca-private-inline]');
    await details.locator('summary').click();
    const inside = page.frameLocator('iframe[data-faisca-inline-frame]');
    await inside.locator('[data-journey-start]').waitFor({ state: 'visible' });
    await inside.locator('[data-journey-start]').click();
    await inside.locator('#faisca-composer').waitFor({ state: 'visible' });
    await inside.locator('#faisca-input').fill('Quero Onepage.');
    await inside.locator('#faisca-send').click();
    await inside.locator('[data-action-id="confirm_goal"]').waitFor({ state: 'visible' });
    await inside.locator('[data-action-id="confirm_goal"]').click();
    await inside.locator('[data-action-id="r08:objective:present_company"]')
      .waitFor({ state: 'visible' });
    assert.match(await inside.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
    assert.equal(await choices.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
  });
  await check('portable server still refuses checkout and external traffic', async () => {
    assert.equal((await page.request.post(server.origin + '/__faisca_lab/messages')).status(), 405);
    assert.equal((await page.request.get(server.origin + '/__faisca_preview/journey-http-r08/')).status(), 404);
    assert.equal((await page.request.get(server.origin + '/login')).status(), 404);
    assert.deepEqual(outgoing, []);
    assert.deepEqual(errors, []);
    assert.deepEqual(await context.cookies(), []);
  });
  process.stdout.write('FAISCA R29 portable Comercial review: ' +
    successful.length + '/' + successful.length + ' checks passed.\n');
} catch (error) {
  process.exitCode = 1;
  process.stderr.write('FAISCA R29 portable preview failed: ' + error.message + '\n');
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
