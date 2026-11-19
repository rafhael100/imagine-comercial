import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startFaiscaOpenAIPrivateReview } from './private-review-http.mjs';

const reportDir = resolve(dirname(fileURLToPath(import.meta.url)), '../reports');
const token = 'R79_CHROMIUM_PRIVATE_REVIEW_TOKEN_2026';
const events = [], blocked = [], errors = [];
let server, browser, context, fatal, providerCalls = 0;

async function check(name, run) {
  try {
    await run();
    events.push({ name, status: 'pass' });
    console.log('PASS ' + name);
  } catch (error) {
    events.push({ name, status: 'fail', error: error.message });
    throw error;
  }
}

try {
  const lab = {
    answer: async caseId => {
      providerCalls++;
      assert.ok(['compare', 'process', 'pricing'].includes(caseId));
      return Object.freeze({
        status: 'draft_answer',
        text: 'O Site Onepage apresenta a empresa em uma página organizada. A Landing Page concentra uma oferta ou campanha específica.',
        sourceIds: Object.freeze(['faisca.passage.onepage.description@r06-1']),
        modelIds: Object.freeze(['gpt-6-luna', 'gpt-6.1-terra']),
        publicReady: false, operationalEffects: false
      });
    },
    inspect: () => ({ calls: providerCalls, externalModelInvocations: 0 })
  };
  server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== server.address || !['GET', 'POST'].includes(req.method())) {
      blocked.push({ method: req.method(), target: url.origin });
      await route.abort();
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  await check('R79 private browser shows fixed scenarios without paid provider dispatch', async () => {
    await page.goto(server.address + '/__faisca_openai_private/review', { waitUntil: 'load' });
    assert.match(await page.title(), /Faísca/);
    assert.equal(await page.locator('#review-case option').count(), 3);
    assert.equal(await page.locator('#review-token').getAttribute('type'), 'password');
    assert.equal(await page.locator('textarea').count(), 0);
    assert.equal(await page.locator('#review-answer').innerText(), 'A resposta validada aparecerá aqui após uma chamada real.');
    assert.equal(providerCalls, 0);
  });

  await check('R79 browser submits only approved caseId and transient review bearer to local HTTP', async () => {
    await page.locator('#review-token').fill(token);
    await page.locator('#review-case').selectOption('compare');
    await page.locator('#review-send').click();
    await page.waitForFunction(() => document.querySelector('#review-status')?.textContent?.includes('Resposta gerada.'));
    assert.equal(await page.locator('#review-token').inputValue(), '', 'Review token must be erased from the DOM immediately.');
    assert.match(await page.locator('#review-answer').innerText(), /Onepage/);
    assert.match(await page.locator('#review-sources').innerText(), /faisca.passage.onepage.description/);
    assert.match(await page.locator('#review-status').innerText(), /Revisão editorial obrigatória/);
    assert.equal(providerCalls, 1);
    assert.equal(server.inspect().requests, 1);
    assert.equal(await page.locator('#review-send').isEnabled(), true);
    assert.deepEqual(blocked, []);
  });

  await check('R83 Chromium refuses a forged draft with zero model provenance', async () => {
    const endpoint = '**/__faisca_openai_private/respond';
    await page.route(endpoint, async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        schema: 'faisca.openai-private-review-response.v1',
        status: 'draft_answer', syntheticCaseId: 'compare',
        answer: 'Uma resposta fictícia sem o modelo de origem comprovado não deve aparecer.',
        sources: ['faisca.passage.onepage.description@r06-1'], models: [],
        requiresEditorialReview: true, publicReady: false, operationalEffects: false
      }) });
    });
    try {
      await page.locator('#review-token').fill(token);
      await page.locator('#review-case').selectOption('compare');
      await page.locator('#review-send').click();
      await page.waitForFunction(() => document.querySelector('#review-status')?.textContent?.includes('não concluiu.'));
      assert.equal(await page.locator('#review-token').inputValue(), '');
      assert.equal(await page.locator('#review-answer').innerText(), 'Resposta indisponível neste teste.');
      assert.equal(await page.locator('#review-sources').innerText(), '');
      assert.equal(providerCalls, 1, 'Forged HTTP proof must not dispatch the paid provider.');
    } finally { await page.unroute(endpoint); }
  });
  await check('R79 incorrect bearer displays neutral refusal and cannot dispatch the provider', async () => {
    await page.locator('#review-token').fill('INVALID_BEARER_TOKEN_SYNTHETIC_123456');
    await page.locator('#review-send').click();
    await page.waitForFunction(() => document.querySelector('#review-status')?.textContent?.includes('não concluiu.'));
    assert.equal(await page.locator('#review-answer').innerText(), 'Resposta indisponível neste teste.');
    assert.equal(await page.locator('#review-sources').innerText(), '');
    assert.equal(providerCalls, 1);
  });

  await check('R79 page never persists secrets and respects responsive WCAG A/AA', async () => {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(axe.violations.map(v => v.id), [], 'WCAG at ' + width + 'px');
    }
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie
    })), { local: 0, session: 0, cookie: '' });
    assert.deepEqual(errors, []);
    assert.deepEqual(blocked, []);
  });

  await check('R79 pagehide clears the review token in the browser', async () => {
    await page.goto('about:blank');
    await page.goto(server.address + '/__faisca_openai_private/review');
    assert.equal(await page.locator('#review-token').inputValue(), '');
    assert.equal(providerCalls, 1);
  });
} catch (error) {
  fatal = { name: error?.name ?? 'R79_BROWSER', message: error?.message ?? 'Unknown failure' };
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  await mkdir(reportDir, { recursive: true });
  await writeFile(resolve(reportDir, 'Faisca_R79_PRIVATE_BROWSER_QA.json'), JSON.stringify({
    status: fatal ? 'failed' : 'passed',
    syntheticOnly: true,
    realOpenAIInvocations: 0,
    providerFixtureCalls: providerCalls,
    reports: events,
    blockedRequests: blocked,
    pageErrors: errors,
    fatal
  }, null, 2) + '\n');
  console.log('R79 Chromium private review: ' + events.filter(x => x.status === 'pass').length +
    '/' + events.length + ' checks passed, no paid API calls.');
  if (fatal) console.error(fatal.name + ': ' + fatal.message);
}
