import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { buildDemo } from './build-demo.mjs';

// Synthetic, loopback-only browser checks. Nothing is deployed or sent to a service.
const root = dirname(fileURLToPath(import.meta.url));
const reports = resolve(root, 'reports');
const results = [];
const errors = [];
const unexpectedRequests = [];
const require = createRequire(import.meta.url);
const versions = {
  node: process.version,
  playwright: require('playwright/package.json').version,
  axePlaywright: JSON.parse(await readFile(resolve(dirname(require.resolve('@axe-core/playwright')), '..', 'package.json'), 'utf8')).version,
  axeCore: require('axe-core/package.json').version
};
let build;
let fixtureSha256;
let browser;
let server;
let context;
let page;
let fatal;
let phase = 'build';

function observePage(target) {
  target.on('pageerror', error => errors.push(error.message));
  target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  target.on('dialog', async dialog => { errors.push('Unexpected JavaScript dialog'); await dialog.dismiss(); });
}

async function check(name, run) {
  try { await run(); results.push({ name, status: 'pass' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'fail', error: error.message }); throw error; }
}

const idle = async () => page.waitForFunction(() =>
  document.querySelector('#faisca-log').getAttribute('aria-busy') !== 'true' &&
  !document.querySelector('#faisca-send').disabled);
const choose = async id => {
  await page.locator(`#faisca-quick-actions [data-action-id="${id}"]`).click();
  await idle();
};
const say = async text => {
  await page.locator('#faisca-input').fill(text);
  await page.locator('#faisca-send').click();
  await idle();
};
const replyText = () => page.locator('#faisca-log .assistant .message-body').last().innerText();
const summaryText = () => page.locator('#faisca-summary-text').inputValue();

// Only the lifecycle fixture exposes the module API. The delivered HTML is unchanged.
// Its CSP is recomputed for the one explicitly instrumented script, never disabled.
function lifecycleFixture(original) {
  const match = original.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  assert.ok(match, 'expected one standalone script');
  const hook = '\nwindow.__faiscaQa = { mount: mountFaisca, root: document.querySelector("[data-faisca-root]") };' +
    '\nwindow.__faiscaQa.instance = mountFaisca(window.__faiscaQa.root);\n';
  const script = match[1].replace(/\}\)\(\);\s*$/, hook + '})();\n');
  assert.notEqual(script, match[1], 'expected the standalone module closure');
  const hash = value => createHash('sha256').update(value).digest('base64');
  let html = original.replace(match[1], script).replace("'sha256-" + hash(match[1]) + "'", "'sha256-" + hash(script) + "'");
  // Use an ordinary host element so a second independent sibling can be mounted.
  html = html.replace(/<body\b([^>]*)>/i, '<body><div$1>').replace('<script>', '</div><script>');
  assert.match(html, /<div[^>]*data-faisca-root/);
  fixtureSha256 = createHash('sha256').update(html).digest('hex');
  return html;
}

try {
  await mkdir(reports, { recursive: true });
  const built = await buildDemo();
  build = built;
  const html = await readFile(built.path, 'utf8');
  const fixture = lifecycleFixture(html);
  server = createServer((request, response) => {
    if (request.method !== 'GET' || !['/', '/lifecycle'].includes(request.url)) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.url === '/lifecycle' ? fixture : html);
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  phase = 'browser_launch';
  browser = await chromium.launch({ headless: true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE ? { executablePath: process.env.FAISCA_CHROMIUM_EXECUTABLE } : {}) });
  versions.chromium = browser.version();
  phase = 'browser_checks';
  context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'no-preference' });
  const guardRequests = async route => {
    const request = route.request();
    if ([url, url + 'lifecycle'].includes(request.url()) && request.method() === 'GET' && request.isNavigationRequest()) {
      await route.continue(); return;
    }
    unexpectedRequests.push({ url: request.url(), method: request.method() });
    await route.abort();
  };
  await context.route('**/*', guardRequests);
  page = await context.newPage();
  observePage(page);
  await page.goto(url, { waitUntil: 'load' });

  await check('standalone preview boots with exact image and active local UI', async () => {
    await page.locator('#faisca-composer').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.chat-message').count(), 1);
    const image = await page.locator('#faisca-master').evaluate(element => ({
      width: element.naturalWidth, height: element.naturalHeight,
      fit: getComputedStyle(element).objectFit, ready: element.complete
    }));
    assert.deepEqual(image, { width: 1254, height: 1254, fit: 'contain', ready: true });
    assert.equal(await page.locator('body').getAttribute('data-faisca-mode'), 'guided_demo');
    await page.screenshot({ path: resolve(reports, 'desktop.png'), fullPage: true });
  });
  await check('sales qualification produces only a curated local summary', async () => {
    await choose('sell'); await choose('goal_presence'); await choose('materials_help');
    assert.match(await summaryText(), /Site Onepage/);
    assert.match(await summaryText(), /organizar textos e imagens/);
    assert.match(await summaryText(), /nenhum dado foi enviado/);
    await say('Qual é o investimento?');
    assert.doesNotMatch(await replyText(), /R\$\s*\d/);
    assert.match(await replyText(), /Portal|escopo|proposta/i);
  });
  await check('questions compare Google and Meta without confusing the site formats', async () => {
    await say('Qual a diferença entre Google e Meta Ads?');
    assert.match(await replyText(), /Google Ads/);
    assert.match(await replyText(), /Meta Ads/);
    assert.doesNotMatch(await replyText(), /Site Onepage/);
  });
  await check('after-sales requests explain authentication and update the summary', async () => {
    await page.locator('#faisca-reset').click();
    await choose('after_sales'); await choose('support_status');
    assert.match(await replyText(), /autenticar/);
    assert.match(await summaryText(), /Acompanhamento de entrega/);
    assert.equal(await page.locator('#faisca-summary-indicator').innerText(), 'Atualizado');
  });
  await check('sensitive examples are suppressed and markup remains inert text', async () => {
    // Explicit synthetic fixtures; never put actual credentials or customer data here.
    await say('minha senha segredo-ficticio-qa');
    assert.doesNotMatch(await page.locator('#faisca-log').innerText(), /segredo-ficticio-qa/);
    assert.match(await replyText(), /ocultei/);
    await say('teste-ficticio@example.invalid');
    assert.doesNotMatch(await page.locator('#faisca-log').innerText(), /example\.invalid/);
    await say('<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('#faisca-log img').count(), 0);
    assert.doesNotMatch(await summaryText(), /onerror|example\.invalid|segredo-ficticio-qa/);
  });
  await check('reset cancels a pending response and clears history', async () => {
    // Same event-loop turn makes this race deterministic.
    await page.evaluate(() => {
      document.querySelector('#faisca-quick-actions [data-action-id="sell"]').click();
      document.querySelector('#faisca-reset').click();
    });
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.chat-message').count(), 1);
    assert.match(await summaryText(), /Objetivo ainda não selecionado/);
    assert.equal(await page.locator('#faisca-input').evaluate(element => element === document.activeElement), true);
  });
  await check('Enter submits once, Shift+Enter keeps a line break and composition does not submit', async () => {
    await page.locator('#faisca-input').fill('   ');
    await page.locator('#faisca-input').press('Enter');
    assert.equal(await page.locator('.chat-message').count(), 1);
    assert.match(await page.locator('#faisca-feedback').innerText(), /Escreva uma pergunta/);
    await page.locator('#faisca-input').fill('Pergunta sintética');
    await page.locator('#faisca-input').press('Shift+Enter');
    assert.match(await page.locator('#faisca-input').inputValue(), /\n/);
    assert.equal(await page.locator('.chat-message').count(), 1);
    await page.locator('#faisca-input').evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', isComposing: true, bubbles: true, cancelable: true
    })));
    assert.equal(await page.locator('.chat-message').count(), 1);
    await page.locator('#faisca-input').fill('Qual a diferença entre Onepage e Landing Page?');
    await page.locator('#faisca-input').press('Enter');
    await idle();
    assert.equal(await page.locator('.chat-message').count(), 3);
    assert.match(await replyText(), /Onepage/);
  });
  await check('typing during a pending answer preserves the next unsent draft', async () => {
    await page.locator('#faisca-reset').click();
    await page.evaluate(() => {
      document.querySelector('#faisca-quick-actions [data-action-id="sell"]').click();
      const input = document.querySelector('#faisca-input');
      input.value = 'Rascunho sintético ainda não enviado';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await idle();
    assert.equal(await page.locator('#faisca-input').inputValue(), 'Rascunho sintético ainda não enviado');
    assert.doesNotMatch(await page.locator('#faisca-log').innerText(), /Rascunho sintético/);
    await page.locator('#faisca-reset').click();
  });
  await check('a late clipboard result cannot announce an obsolete summary after reset', async () => {
    const observed = await page.evaluate(async () => {
      let resolveCopy;
      let copied;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: text => { copied = text; return new Promise(resolve => { resolveCopy = resolve; }); }
      }});
      document.querySelector('#faisca-copy').click();
      document.querySelector('#faisca-reset').click();
      resolveCopy();
      await Promise.resolve();
      await Promise.resolve();
      delete navigator.clipboard;
      return { copied, status: document.querySelector('#faisca-copy-status').textContent,
        focused: document.activeElement.id, count: document.querySelectorAll('.chat-message').length };
    });
    assert.match(observed.copied, /Objetivo ainda não selecionado/);
    assert.deepEqual({ ...observed, copied: undefined }, { copied: undefined, status: '', focused: 'faisca-input', count: 1 });
  });
  await check('keyboard dismissal restores focus and supports reopening', async () => {
    await page.locator('#faisca-input').press('Escape');
    assert.equal(await page.locator('#faisca-chat').isVisible(), false);
    assert.equal(await page.locator('#faisca-launcher').evaluate(element => element === document.activeElement), true);
    assert.equal(await page.locator('.hero-story').getAttribute('data-state'), 'SLEEP');
    await page.locator('#faisca-launcher').click();
    assert.equal(await page.locator('#faisca-chat').isVisible(), true);
    assert.equal(await page.locator('#faisca-input').evaluate(element => element === document.activeElement), true);
  });
  await check('motion control and system reduced-motion are respected', async () => {
    await page.locator('#faisca-motion').click();
    assert.equal(await page.locator('body').getAttribute('data-motion'), 'paused');
    assert.equal(await page.locator('#faisca-master').evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#faisca-motion').disabled);
    assert.equal(await page.locator('#faisca-master').evaluate(element => getComputedStyle(element).animationName), 'none');
  });
  for (const width of [1440, 390, 320]) {
    await check(`responsive layout and axe WCAG A/AA at ${width}px`, async () => {
      await page.setViewportSize({ width, height: width === 1440 ? 1080 : 844 });
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth
      }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await writeFile(resolve(reports, `axe-${width}.json`), JSON.stringify(audit, null, 2));
      assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations.map(item => ({
        id: item.id, impact: item.impact, targets: item.nodes.map(node => node.target)
      }))));
      await page.screenshot({ path: resolve(reports, `viewport-${width}.png`), fullPage: true });
    });
  }
  await check('no-JavaScript fallback keeps content and hides the inactive form', async () => {
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    await nojs.route('**/*', guardRequests);
    const nojsPage = await nojs.newPage();
    observePage(nojsPage);
    await nojsPage.goto(url, { waitUntil: 'load' });
    assert.equal(await nojsPage.locator('#faisca-composer').isVisible(), false);
    assert.equal(await nojsPage.locator('#faisca-minimize').isVisible(), false);
    assert.equal(await nojsPage.locator('.no-script-note').isVisible(), true);
    assert.equal(await nojsPage.locator('#jornadas h2').isVisible(), true);
    assert.deepEqual(await nojs.cookies(), []);
    await nojs.close();
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url + 'lifecycle', { waitUntil: 'load' });
  await check('mounting an existing root returns one instance without duplicate handlers', async () => {
    assert.equal(await page.evaluate(() => {
      const qa = window.__faiscaQa;
      return qa.instance === qa.mount(qa.root) && qa.instance === qa.mount(qa.root);
    }), true);
    assert.equal(await page.locator('.chat-message').count(), 1);
    await choose('sell');
    assert.equal(await page.locator('.chat-message').count(), 3);
  });
  await check('destroy cancels pending work and removes DOM and global listeners', async () => {
    await page.evaluate(() => {
      const qa = window.__faiscaQa;
      qa.instance.reset();
      qa.root.querySelector('[data-action-id="sell"]').click();
      qa.instance.destroy();
      qa.instance.destroy();
      qa.snapshot = qa.root.outerHTML;
      document.dispatchEvent(new Event('visibilitychange'));
      qa.instance.open(); qa.instance.close(); qa.instance.reset();
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.__faiscaQa.root.outerHTML === window.__faiscaQa.snapshot), true);
    assert.equal(await page.locator('.chat-message').count(), 0);
    assert.equal(await page.locator('#faisca-composer').isVisible(), false);
    assert.equal(await page.locator('#faisca-composer').evaluate(element => element.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )), true, 'no submit listener remains after destroy');
  });
  await check('remount starts clean and a single submit produces a single reply', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.evaluate(() => {
      const qa = window.__faiscaQa;
      const old = qa.instance;
      qa.instance = qa.mount(qa.root);
      return old !== qa.instance && qa.instance === qa.mount(qa.root);
    }), true);
    assert.equal(await page.locator('.chat-message').count(), 1);
    assert.match(await summaryText(), /Objetivo ainda não selecionado/);
    await say('Qual a diferença entre Onepage e Landing Page?');
    assert.equal(await page.locator('.chat-message').count(), 3);
    assert.equal(await page.locator('#faisca-input').inputValue(), '');
  });
  await check('clipboard resolution or failure after destroy cannot alter the replacement instance', async () => {
    for (const outcome of ['resolve', 'reject']) {
      const observed = await page.evaluate(async outcome => {
        const qa = window.__faiscaQa;
        let finish;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: () => new Promise((resolve, reject) => {
            finish = outcome === 'resolve' ? resolve : () => reject(new Error('Synthetic clipboard failure'));
          })
        }});
        qa.root.querySelector('#faisca-copy').click();
        qa.instance.destroy();
        qa.instance = qa.mount(qa.root);
        qa.root.querySelector('#faisca-input').focus();
        const snapshot = qa.root.outerHTML;
        finish();
        await Promise.resolve(); await Promise.resolve();
        delete navigator.clipboard;
        return { unchanged: qa.root.outerHTML === snapshot,
          focused: document.activeElement.id, status: qa.root.querySelector('#faisca-copy-status').textContent };
      }, outcome);
      assert.deepEqual(observed, { unchanged: true, focused: 'faisca-input', status: '' });
    }
  });
  await check('two sibling instances keep IDs, ARIA references and conversations independent', async () => {
    await page.evaluate(() => {
      const qa = window.__faiscaQa;
      qa.instance.destroy();
      qa.secondRoot = qa.root.cloneNode(true);
      qa.secondRoot.querySelectorAll('script').forEach(node => node.remove());
      qa.root.after(qa.secondRoot);
      qa.instance = qa.mount(qa.root);
      qa.second = qa.mount(qa.secondRoot);
      qa.byId = (root, id) => root.querySelector('[data-faisca-id="' + id + '"]');
      qa.root.querySelector('[data-action-id="sell"]').click();
      qa.secondRoot.querySelector('[data-action-id="after_sales"]').click();
    });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-faisca-id="faisca-send"]')].every(node => !node.disabled));
    await page.evaluate(() => {
      const qa = window.__faiscaQa;
      qa.root.querySelector('[data-action-id="goal_presence"]').click();
      qa.secondRoot.querySelector('[data-action-id="support_status"]').click();
    });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-faisca-id="faisca-send"]')].every(node => !node.disabled));
    const observed = await page.evaluate(() => {
      const qa = window.__faiscaQa;
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      const badReferences = [];
      for (const root of [qa.root, qa.secondRoot]) {
        for (const element of root.querySelectorAll('[for],[aria-labelledby],[aria-describedby],[aria-controls]')) {
          for (const attr of ['for','aria-labelledby','aria-describedby','aria-controls']) {
            for (const id of (element.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) {
              if (!root.contains(document.getElementById(id))) badReferences.push({ attr, id });
            }
          }
        }
      }
      return { uniqueIds: ids.length === new Set(ids).size, badReferences,
        first: qa.byId(qa.root, 'faisca-summary-text').value,
        second: qa.byId(qa.secondRoot, 'faisca-summary-text').value,
        body: document.body.dataset.faiscaMode || null };
    });
    assert.equal(observed.uniqueIds, true);
    assert.deepEqual(observed.badReferences, []);
    assert.equal(observed.body, null, 'component does not write its state to the host body');
    assert.match(observed.first, /Site Onepage/);
    assert.doesNotMatch(observed.first, /Acompanhamento de entrega/);
    assert.match(observed.second, /Acompanhamento de entrega/);
    assert.doesNotMatch(observed.second, /Site Onepage/);
  });
  await check('closing, pausing or destroying one instance leaves its sibling usable', async () => {
    const observed = await page.evaluate(() => {
      const qa = window.__faiscaQa;
      qa.byId(qa.root, 'faisca-motion').click();
      const motion = [qa.root.dataset.motion, qa.secondRoot.dataset.motion];
      qa.instance.close();
      const visibility = [qa.byId(qa.root, 'faisca-chat').hidden, qa.byId(qa.secondRoot, 'faisca-chat').hidden];
      const secondSnapshot = qa.secondRoot.outerHTML;
      qa.instance.destroy();
      const siblingUnchanged = qa.secondRoot.outerHTML === secondSnapshot;
      qa.second.reset();
      qa.secondRoot.querySelector('[data-action-id="faq"]').click();
      return { motion, visibility, siblingUnchanged };
    });
    assert.deepEqual(observed, { motion: ['paused', 'enabled'], visibility: [true, false], siblingUnchanged: true });
    await page.waitForFunction(() => !window.__faiscaQa.byId(window.__faiscaQa.secondRoot, 'faisca-send').disabled);
    assert.equal(await page.evaluate(() => window.__faiscaQa.secondRoot.querySelectorAll('.chat-message').length), 3);
  });
  await check('no persistence, unexpected network, runtime errors or CSP failures', async () => {
    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(errors, []);
  });
} catch (error) {
  fatal = error.message;
  console.error(error.stack);
  process.exitCode = 1;
  if (page) await page.screenshot({ path: resolve(reports, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  if (browser) await browser.close();
  if (server?.listening) await new Promise(resolveClose => server.close(resolveClose));
  await writeFile(resolve(reports, 'report.json'), JSON.stringify({
    mode: 'synthetic_loopback_review_only',
    status: fatal ? (phase === 'browser_launch' ? 'blocked_environment' : 'failed') : 'passed',
    phase,
    browser: browser ? 'STARTED' : 'NOT_RUN',
    axe: results.some(item => item.name.includes('axe WCAG')) ? 'ATTEMPTED' : 'NOT_RUN',
    versions, build, fixture: { purpose: 'test-only lifecycle API exposure', sha256: fixtureSha256 },
    results, errors, unexpectedRequests, ...(fatal ? { fatal } : {})
  }, null, 2));
}
