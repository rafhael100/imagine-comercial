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

  await check('R28 preserves F357 cart guard and trusted WhatsApp during Faísca staging', async () => {
    const simulator = page.locator('#simular-compra[data-choice-preview]');
    assert.equal(await simulator.count(), 1);
    await simulator.locator('[data-choice-site="none"]').click();
    const contact = simulator.locator('[data-choice-action]');
    assert.equal(await contact.getAttribute('aria-disabled'), 'true');
    const before = page.url();
    assert.equal(await contact.evaluate(link =>
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))), false,
      'An empty selection must not navigate to contact from the private Faísca preview.');
    assert.equal(page.url(), before);
    await simulator.locator('[data-choice-site="onepage"]').click();
    assert.equal(await contact.getAttribute('aria-disabled'), 'false');
    const target = new URL(await contact.getAttribute('href'));
    assert.equal(target.origin, 'https://wa.me');
    assert.equal(target.pathname, '/5585996632689');
    assert.deepEqual([...target.searchParams.keys()], ['text']);
    assert.ok(target.searchParams.get('text').length > 0);
    assert.equal(await page.locator('[data-faisca-private-entry]').count(), 1,
      'The Faísca private entry must not hide or replace the Commercial cart.');
  });

  await check('R25 inline assistant runs in the real Comercial page without replacing CTAs', async () => {
    const disclosure = page.locator('[data-faisca-private-inline]');
    assert.equal(await disclosure.count(), 1);
    assert.equal(await disclosure.getAttribute('open'), null);
    await disclosure.locator('summary').click();
    assert.equal(await disclosure.getAttribute('open'), '');
    const frame = page.frameLocator('iframe[data-faisca-inline-frame]');
    await frame.locator('[data-journey-start]').waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await frame.locator('#faisca-composer').isVisible(), false);
    await frame.locator('[data-journey-start]').click();
    await frame.locator('#faisca-composer').waitFor({ state: 'visible' });
    const input = frame.locator('#faisca-input');
    await input.fill('Quero Onepage.');
    await frame.locator('#faisca-send').click();
    await frame.locator('#faisca-quick-actions [data-action-id="confirm_goal"]')
      .waitFor({ state: 'visible' });
    await frame.locator('#faisca-quick-actions [data-action-id="confirm_goal"]').click();
    await frame.locator('#faisca-quick-actions [data-action-id="r08:objective:present_company"]')
      .waitFor({ state: 'visible' });
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-mode'),
      'r08_local_qualification');
    assert.match(await frame.locator('#faisca-summary-text').inputValue(), /Site Onepage/);
    assert.equal(await page.locator('#simular-compra[data-choice-preview]').count(), 1,
      'Real Comercial quote simulator must remain alongside the inline Faísca.');
    assert.ok(await page.locator('a[data-purchase-start]').count() >= 1);

    // R37: the handoff requires completed qualification AND an explicit
    // click. Never forward free text, contact preference, identity or price.
    const quote = page.locator('#simular-compra[data-choice-preview]');
    await quote.locator('[data-choice-site="landing-pages"]').click();
    const transfer = page.locator('[data-faisca-apply-choice]');
    await transfer.click();
    assert.match(await page.locator('[data-faisca-apply-status]').innerText(), /Conclua a qualificação/);
    assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-quote-site'), null);

    const chooseWithin = async (id, nextId) => {
      await frame.locator('#faisca-quick-actions [data-action-id="' + id + '"]').click();
      await frame.locator('#faisca-quick-actions [data-action-id="' + nextId + '"]')
        .waitFor({ state: 'visible', timeout: 12000 });
    };
    await chooseWithin('r08:objective:present_company', 'r08:audience:businesses');
    await chooseWithin('r08:audience:businesses', 'r08:materials:ready');
    await chooseWithin('r08:materials:ready', 'r08:timeline:within_30_days');
    await chooseWithin('r08:timeline:within_30_days', 'r08:contactConsent:declined');
    await chooseWithin('r08:contactConsent:declined', 'r08:next_steps');
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-quote-site'), 'onepage');
    await frame.locator('[data-faisca-root]').evaluate(el =>
      el.setAttribute('data-faisca-quote-site', 'javascript:untrusted'));
    await transfer.click();
    assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'),
      'true', 'Unapproved site value must not affect the Commercial simulator.');
    await frame.locator('[data-faisca-root]').evaluate(el =>
      el.setAttribute('data-faisca-quote-site', 'onepage'));
    await transfer.click();
    assert.equal(await quote.locator('[data-choice-site="onepage"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('[data-faisca-apply-status]').innerText(),
      /Site Onepage selecionado no simulador local/);
    assert.equal(await page.locator('#simular-compra form, #simular-compra input[type="email"]').count(), 0);

    // R42: a completed profile must STOP authorizing handoff as soon as
    // the visitor starts switching services, even though the old profile
    // remains in memory until confirmation.
    await chooseWithin('r08:next_steps','r08:change_service');
    await chooseWithin('r08:change_service','goal_campaign');
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-quote-site'), null);
    await quote.locator('[data-choice-site="landing-pages"]').click();
    await transfer.click();
    assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('[data-faisca-apply-status]').innerText(), /Conclua a qualificação/);
    await chooseWithin('goal_campaign','confirm_goal');
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-quote-site'), null);
    await transfer.click();
    assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
    await chooseWithin('cancel_goal','r08:next_steps');
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-quote-site'), 'onepage');

    // An ongoing UI turn cannot supply a quote choice even with a stale
    // attribute: the bridge refuses when aria-busy is true.
    const log = frame.locator('[data-faisca-id="faisca-log"]');
    await log.evaluate(el=>el.setAttribute('aria-busy','true'));
    await transfer.click();
    assert.match(await page.locator('[data-faisca-apply-status]').innerText(), /Conclua a resposta atual/);
    assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
    await log.evaluate(el=>el.setAttribute('aria-busy','false'));
    await transfer.click();
    assert.equal(await quote.locator('[data-choice-site="onepage"]').getAttribute('aria-pressed'), 'true');
    await frame.locator('#faisca-reset').click();
    assert.equal(await frame.locator('[data-faisca-root]').getAttribute('data-faisca-quote-site'), null);
    await quote.locator('[data-choice-site="landing-pages"]').click();
    await transfer.click();
    assert.match(await page.locator('[data-faisca-apply-status]').innerText(), /Conclua a qualificação/);
    assert.equal(await quote.locator('[data-choice-site="landing-pages"]').getAttribute('aria-pressed'), 'true');
    await disclosure.locator('summary').click();
    assert.equal(await disclosure.getAttribute('open'), null);
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
    await page.locator('[data-faisca-root][data-faisca-mounted="true"]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-input').isDisabled(), true);
    await choose('after_sales');
    await choose('r10:topic:technical');
    await choose('r10:service:onepage');
    await choose('r10:detail:contact_form');
    assert.match(await page.locator('#faisca-summary-text').inputValue(),
      /Nenhum ticket foi aberto/);
    const count = await page.locator('#faisca-log .assistant').count();
    const summary = await page.locator('#faisca-summary-text').inputValue();
    await page.evaluate(() => {
      document.querySelector('#faisca-input').value = 'R24_TEST_SECRET_123';
      document.querySelector('#faisca-composer').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(await page.locator('#faisca-input').inputValue(), '');
    assert.equal(await page.locator('#faisca-log .assistant').count(), count);
    assert.equal(await page.locator('#faisca-summary-text').inputValue(), summary);
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
