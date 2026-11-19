import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startPrivateCommercialFaisca } from './commercial-preview.mjs';

const password = 'R24_SYNTHETIC_PRIVATE_REVIEW_PASSWORD_123';
let server, browser, context;
const external = [], errors = [], results = [];
const check = async (name, callback) => {
  await callback();
  results.push(name);
  process.stdout.write('PASS FAISCA R24 ' + name + '\n');
};

try {
  server = await startPrivateCommercialFaisca({ password });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    httpCredentials: { username: 'reviewer', password },
    viewport: { width: 390, height: 844 }
  });
  await context.route('**/*', async route => {
    const request = route.request();
    let u;
    try { u = new URL(request.url()); } catch {}
    if (!u || u.origin !== server.origin ||
        !['GET', 'HEAD'].includes(request.method())) {
      external.push(request.url());
      await route.abort();
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const last = () => page.locator('#faisca-log .assistant .message-body').last();
  const next = async perform => {
    const previous = await page.locator('#faisca-log .assistant').last().elementHandle();
    await perform();
    await page.waitForFunction(old => {
      const log = document.querySelector('#faisca-log');
      const last = [...(log?.querySelectorAll('.assistant') ?? [])].at(-1);
      return log?.getAttribute('aria-busy') === 'false' && last && last !== old;
    }, previous, { timeout: 10000 });
  };
  const choose = id => next(() => page.locator(
    '#faisca-quick-actions [data-action-id="' + id + '"]').click());
  const type = text => next(async () => {
    await page.locator('#faisca-input').fill(text);
    await page.locator('#faisca-send').click();
  });

  await check('commercial home keeps its real purchase links and adds a review-only Faísca entry', async () => {
    await page.goto(server.origin + '/', { waitUntil: 'load' });
    assert.equal(await page.locator('[data-faisca-private-entry]').count(), 1);
    assert.equal(await page.locator('#simular-compra[data-choice-preview]').count(), 1);
    assert.ok(await page.locator('a[data-purchase-start]').count() >= 1);
    assert.equal(await page.locator('[data-faisca-private-entry] a').getAttribute('href'),
      '/__faisca_preview/journey/');
    assert.match(await page.locator('[data-faisca-private-entry]').innerText(),
      /sem criar pedidos, pagamentos ou leads/i);
    assert.match((await page.locator('meta[name="robots"]').getAttribute('content') ?? '') +
      (await page.evaluate(() => document.body.innerText)), /Imagine/i);
    const panelAxe = await new AxeBuilder({ page })
      .include('[data-faisca-private-entry]')
      .withTags(['wcag2a', 'wcag2aa']).analyze();
    assert.equal(panelAxe.violations.length, 0,
      'Faísca private link has WCAG 2.1 A/AA issues: ' +
      panelAxe.violations.map(v => v.id).join(','));
  });

  await check('private Faísca loads R08 on the exact same protected commercial origin', async () => {
    await page.locator('[data-faisca-private-entry] a').click();
    assert.equal(new URL(page.url()).origin, server.origin);
    assert.equal(new URL(page.url()).pathname, '/__faisca_preview/journey/');
    await page.locator('[data-journey-start]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-master').evaluate(image =>
      image.complete && image.naturalWidth === 1254), true);
    await page.locator('[data-journey-start]').click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-faisca-root]').getAttribute('data-faisca-mode'),
      'r08_local_qualification');
  });

  await check('R24 completes local qualifying and offers reviewed comparison without a purchase', async () => {
    await type('Quero Onepage.');
    await choose('confirm_goal');
    for (const id of [
      'r08:objective:capture_leads', 'r08:audience:businesses',
      'r08:materials:ready', 'r08:timeline:within_30_days',
      'r08:contactConsent:declined'
    ]) await choose(id);
    assert.match(await page.locator('#faisca-summary-text').inputValue(),
      /RESUMO DE ATENDIMENTO — RASCUNHO NÃO ENVIADO/);
    await choose('r08:next_steps');
    assert.match(await last().innerText(), /comparar também com Landing Page/i);
    assert.match(await last().innerText(), /contratação pública ainda não está disponível/i);
    await choose('compare_sites');
    assert.match(await last().innerText(), /RASCUNHO NÃO ENVIADO/);
    assert.equal(await page.locator('#faisca-log .assistant').last()
      .locator('.message-sources').count(), 1);
    assert.deepEqual(await context.cookies(), []);
  });

  await check('anonymous support runs locally and does not issue an authenticated ticket', async () => {
    await page.goto(server.origin + '/__faisca_preview/support/', { waitUntil: 'load' });
    await page.locator('[data-support-start]').click();
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    await choose('after_sales');
    await choose('r10:topic:technical');
    await choose('r10:service:onepage');
    await choose('r10:detail:contact_form');
    assert.match(await page.locator('#faisca-summary-text').inputValue(),
      /Nenhum ticket foi aberto/);
    await type('Minha senha é R24_TEST_SECRET_123');
    assert.doesNotMatch(await page.locator('#faisca-log').innerText(), /R24_TEST_SECRET_123/);
  });

  await check('private staging refuses API, cookies, external requests and runtime network', async () => {
    const response = await page.request.post(server.origin + '/__faisca_lab/messages');
    assert.equal(response.status(), 405);
    assert.equal((await page.request.get(server.origin +
      '/__faisca_preview/journey-http-r08/')).status(), 404);
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({
      local: localStorage.length, session: sessionStorage.length, cookie: document.cookie
    })), { local: 0, session: 0, cookie: '' });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  });
  process.stdout.write('FAISCA R24 private Comercial browser: ' +
    results.length + '/' + results.length + ' checks passed; no external effects.\n');
} catch (e) {
  process.exitCode = 1;
  process.stderr.write('FAISCA R24 composition QA failed: ' + e.message + '\n');
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
