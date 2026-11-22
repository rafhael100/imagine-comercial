import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createFaiscaLocalReservationLedger } from './durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from './live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from './private-review-http.mjs';

// R220: a browser-level cumulative private staging rehearsal of R95–R219.
// No API credential, customer data, VPS, external network or public route.
const token = 'R220_PRIVATE_BROWSER_SYNTHETIC_TEST_TOKEN_123456';
const key = 'sk-r220-private-fictional-fixture-never-real-123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento fictício e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';
const privatePage = '/__faisca_openai_private/review';

function provider(model, invalid) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{
      type: 'output_text', text: JSON.stringify(
        model === FAISCA_OPENAI_MODELS.classification
          ? { topic: 'general' } : { reply: answer })
    }] }],
    usage: {
      input_tokens: 180, output_tokens: 35, total_tokens: 215,
      input_tokens_details: { cached_tokens: invalid ? 181 : 24 },
      output_tokens_details: { reasoning_tokens: 5 }
    }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function lab(ledger, transport) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 8, maxBudgetUsd: 1,
    reservationLedger: ledger, fetchImpl: transport
  });
}
async function submit(browser, server, expected, expectedAnswer) {
  const context = await browser.newContext({ viewport: { width: 390, height: 850 } });
  const outbound = [];
  const replies = [];
  try {
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (!url.startsWith(server.address + '/')) {
        outbound.push(url);
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const page = await context.newPage();
    page.on('response', response => {
      if (response.url() === server.address + endpoint) replies.push(response.status());
    });
    await page.goto(server.address + privatePage, { waitUntil: 'load' });
    assert.equal(await page.locator('#review-conversation').count(), 1);
    assert.equal(await page.locator('#review-token').getAttribute('type'), 'password');
    await page.locator('#review-token').fill(token);
    await page.locator('#review-question').fill(question);
    await page.locator('#review-attestation').check();
    await page.locator('#review-send').click();
    await page.waitForFunction(needle =>
      (document.querySelector('#review-status')?.textContent ?? '').includes(needle),
    expected, { timeout: 20000 });
    assert.equal(await page.locator('#review-answer').innerText(), expectedAnswer);
    assert.equal(await page.locator('#review-sources').innerText(), '');
    assert.equal(await page.locator('#review-token').inputValue(), '');
    assert.equal(await page.locator('#review-question').inputValue(), '');
    assert.equal(await page.locator('#review-attestation').isChecked(), false);
    assert.equal(await page.locator('#review-send').isEnabled(), true);
    assert.deepEqual(outbound, [], 'No external browser request allowed');
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({
      local: localStorage.length, session: sessionStorage.length, cookies: document.cookie
    })), { local: 0, session: 0, cookies: '' });
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v => v.id), [], 'No WCAG A/AA violations');
    assert.deepEqual(replies, [expectedAnswer === answer ? 200 : 503],
      'Exactly one private HTTP request; no implicit paid retry');
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true,
  ...(process.env.FAISCA_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
try {
  for (const invalid of [false, true]) {
    const root = await mkdtemp(join(tmpdir(), 'faisca-r220-'));
    const directory = join(root, 'ledger');
    let server;
    try {
      await mkdir(directory, { mode: 0o700 });
      const ledger = () => createFaiscaLocalReservationLedger({
        directory, maxRequests: 8, maxBudgetUsd: 1
      });
      const models = [];
      server = await startFaiscaOpenAIPrivateReview({
        lab: lab(ledger(), async (_url, options) => {
          const payload = JSON.parse(options.body);
          assert.equal(payload.store, false);
          assert.deepEqual(payload.tools, []);
          assert.equal(payload.tool_choice, 'none');
          models.push(payload.model);
          return provider(payload.model, invalid &&
            payload.model === FAISCA_OPENAI_MODELS.classification);
        }),
        reviewToken: token, enablePrivateConversation: true
      });
      await submit(browser, server,
        invalid ? 'não concluiu.' : 'Resposta gerada.',
        invalid ? 'Resposta indisponível neste teste.' : answer);
      assert.deepEqual(models, invalid
        ? [FAISCA_OPENAI_MODELS.classification]
        : [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer]);
      await server.close();
      server = null;
      assert.equal((await ledger().inspectReadOnly()).requests, models.length);
      if (invalid) {
        assert.equal(await readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
          'faisca.private-provider-outcome-uncertain.v1\n');
        await assert.rejects(ledger().ready(), /operator reconciliation/);
        let restartedCalls = 0;
        server = await startFaiscaOpenAIPrivateReview({
          lab: lab(ledger(), async () => {
            restartedCalls++;
            throw new Error('Restart after uncertain usage must not dispatch');
          }), reviewToken: token, enablePrivateConversation: true
        });
        await submit(browser, server, 'não concluiu.',
          'Resposta indisponível neste teste.');
        assert.equal(restartedCalls, 0, 'No provider call after restart');
        assert.equal((await ledger().inspectReadOnly()).requests, 1);
      } else {
        await assert.rejects(
          readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
          { code: 'ENOENT' });
        assert.equal(await ledger().ready(), true);
      }
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  }
  console.log('R220 PRIVATE SYNTHETIC BROWSER + HTTP + LUNA/TERRA + DURABLE LEDGER VERIFIED; NO PUBLIC GO.');
} finally {
  await browser.close();
}
