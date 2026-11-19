import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// R45 executes solely against the ephemeral 127.0.0.1 Nginx process started
// by check-nginx-loopback.py. Never accept a remote or user-hosted endpoint.
const origin = process.env.FAISCA_R45_ORIGIN;
const password = process.env.FAISCA_R45_SYNTHETIC_PASSWORD;
if (typeof origin !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(origin) ||
    typeof password !== 'string' || password.length < 24 || password.length > 128) {
  throw new TypeError('R45 requires the disposable loopback Nginx URL and synthetic password.');
}

let browser, context;
const outgoing = [];
const errors = [];
const checks = [];
const mime = [];
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  process.stdout.write('PASS FAISCA R45 ' + name + '\n');
};
try {
  const anonymous = await fetch(origin + '/');
  await check('Nginx denies anonymous access before loading any private HTML', async () => {
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get('www-authenticate') ?? '', /^Basic/);
    assert.match(anonymous.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.equal(anonymous.headers.get('set-cookie'), null);
  });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    httpCredentials: { username: 'reviewer', password }
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.origin !== origin || (method !== 'GET' && method !== 'HEAD')) {
      outgoing.push({ origin: url.origin === origin ? 'internal' : 'external', method });
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (/\/_astro\/.*\.(?:js|css)$/.test(path)) {
      mime.push({
        ext: path.endsWith('.js') ? 'js' : 'css',
        status: response.status(),
        type: response.headers()['content-type'] ?? ''
      });
    }
  });

  await check('real Nginx serves Commercial and opens Faísca iframe under Basic Auth', async () => {
    const response = await page.goto(origin + '/', { waitUntil: 'load' });
    assert.equal(response?.status(), 200);
    assert.equal(await page.locator('[data-faisca-private-entry]').count(), 1);
    assert.equal(await page.locator('#simular-compra[data-choice-preview]').count(), 1);
    const simulator = page.locator('#simular-compra[data-choice-preview]');
    await simulator.locator('[data-choice-site="landing-pages"]').click();
    assert.equal(await simulator.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');

    const disclosure = page.locator('[data-faisca-private-inline]');
    await disclosure.locator('summary').click();
    assert.equal(await disclosure.getAttribute('open'), '');
    const frame = page.frameLocator('iframe[data-faisca-inline-frame]');
    await frame.locator('[data-journey-start]').waitFor({ state: 'visible', timeout: 12000 });
    assert.equal(await frame.locator('[data-journey-start]').count(), 1);
    assert.equal(await frame.locator('#faisca-master').evaluate(img =>
      img.complete && img.naturalWidth === 1254), true);
    await frame.locator('[data-journey-start]').click();
    await frame.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-mode'),
      'r08_local_qualification');

    await frame.locator('#faisca-input').fill('Quero Onepage.');
    await frame.locator('#faisca-send').click();
    await frame.locator('#faisca-quick-actions [data-action-id="confirm_goal"]')
      .waitFor({ state: 'visible' });
    await frame.locator('#faisca-quick-actions [data-action-id="confirm_goal"]').click();
    await frame.locator('#faisca-quick-actions [data-action-id="r08:objective:present_company"]')
      .waitFor({ state: 'visible' });

    const choose = async (id, nextId) => {
      await frame.locator('#faisca-quick-actions [data-action-id="' + id + '"]').click();
      await frame.locator('#faisca-quick-actions [data-action-id="' + nextId + '"]')
        .waitFor({ state: 'visible', timeout: 12000 });
    };
    const transfer = page.locator('[data-faisca-apply-choice]');
    await transfer.click();
    assert.match(await page.locator('[data-faisca-apply-status]').innerText(), /Conclua a qualificação/);
    assert.equal(await simulator.locator('[data-choice-site="landing-pages"]')
      .getAttribute('aria-pressed'), 'true', 'No transfer before qualification.');
    await choose('r08:objective:present_company', 'r08:audience:businesses');
    await choose('r08:audience:businesses', 'r08:materials:ready');
    await choose('r08:materials:ready', 'r08:timeline:within_30_days');
    await choose('r08:timeline:within_30_days', 'r08:contactConsent:declined');
    await choose('r08:contactConsent:declined', 'r08:next_steps');
    assert.equal(await frame.locator('[data-faisca-root]')
      .getAttribute('data-faisca-quote-site'), 'onepage');
    await transfer.click();
    assert.equal(await simulator.locator('[data-choice-site="onepage"]')
      .getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('[data-faisca-apply-status]').innerText(),
      /Site Onepage selecionado no simulador local/);
    assert.equal(await simulator.locator('form, input[type="email"]').count(), 0);
    assert.equal(await context.cookies().then(a => a.length), 0);
  });

  await check('Nginx correctly labels JavaScript/CSS resources used by the browser', async () => {
    assert.ok(mime.some(item => item.ext === 'js'), 'Expected real JS module requests.');
    assert.ok(mime.some(item => item.ext === 'css'), 'Expected compiled CSS requests.');
    for (const item of mime) {
      assert.equal(item.status, 200);
      if (item.ext === 'js') assert.match(item.type, /^(?:application|text)\/javascript/);
      else assert.match(item.type, /^text\/css/);
    }
  });

  await check('Nginx does not expose the private PHP/API routes or permit writes', async () => {
    const blocked = await page.request.post(origin + '/__faisca_lab/messages');
    assert.ok([403, 405].includes(blocked.status()));
    const php = await page.request.get(origin + '/__faisca_preview/journey-http-r08/');
    assert.equal(php.status(), 404);
    assert.equal(php.headers()['set-cookie'], undefined);
    assert.deepEqual(await page.evaluate(() => ({
      local: localStorage.length, session: sessionStorage.length, cookie: document.cookie
    })), { local: 0, session: 0, cookie: '' });
    assert.deepEqual(outgoing, [], 'Only authenticated loopback GET/HEAD is permitted.');
    assert.deepEqual(errors, [], 'The browser must not report uncaught JavaScript errors.');
  });

  process.stdout.write('R45 actual Nginx + Chromium: ' + checks.length +
    '/' + checks.length + ' checks, no external model / checkout / deploy.\n');
} catch (error) {
  process.exitCode = 1;
  process.stderr.write('R45 browser HOLD: ' + error.message + '\n');
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
