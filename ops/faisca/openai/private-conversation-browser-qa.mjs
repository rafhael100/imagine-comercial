import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startFaiscaOpenAIPrivateReview } from './private-review-http.mjs';

const token = 'R95_PRIVATE_CHROMIUM_TOKEN_ONLY_FIXTURE_2026';
const report = [], errors = [], external = [];
const reply = 'Uma landing page pode organizar informações de um evento e destacar como as pessoas podem participar.';
let browser, context, server, page, calls = 0, failure = null;
function assertNoExternal(url) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) external.push(url);
}
async function step(name, fn) {
  try { await fn(); report.push({name,status:'pass'}); }
  catch(error) { report.push({name,status:'fail'}); throw error; }
}
try {
  const lab = {
    answer: async () => { throw Error('No model for a fixed case in this test'); },
    answerPrivateConversation: async input => {
      calls++;
      assert.equal(input.question, 'Vale a pena usar uma landing page para divulgar um evento?');
      return {
        status:'general_answer', text:reply, sourceIds:[],
        modelIds:['gpt-6-luna','gpt-6.1-terra'], publicReady:false,
        operationalEffects:false
      };
    },
    inspect:()=>({calls,syntheticOnly:true})
  };
  server = await startFaiscaOpenAIPrivateReview({
    lab,reviewToken:token,enablePrivateConversation:true
  });
  browser = await chromium.launch({headless:true,
    ...(process.env.FAISCA_CHROMIUM_EXECUTABLE
      ? {executablePath:process.env.FAISCA_CHROMIUM_EXECUTABLE} : {})});
  context = await browser.newContext({viewport:{width:390,height:850}});
  await context.route('**/*', async route => {
    const url=route.request().url();
    assertNoExternal(url);
    if (!url.startsWith(server.address+'/')) await route.abort();
    else await route.continue();
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await step('R95 opt-in field is accessible and no model calls happen on GET',async()=>{
    await page.goto(server.address+'/__faisca_openai_private/review');
    assert.equal(await page.locator('#review-conversation').count(),1);
    assert.equal(await page.locator('#review-question').count(),1);
    assert.equal(await page.locator('#review-attestation').count(),1);
    assert.equal(await page.locator('#review-token').getAttribute('type'),'password');
    assert.equal(calls,0);
  });
  await step('R132 actual Chromium rejects invisible Unicode before private HTTP', async()=>{
    for (const marker of ['\u00ad', '\ufeff', '\u2066', '\u200d', '\u034f']) {
      await page.locator('#review-token').fill(token);
      await page.locator('#review-question').fill('Quero um site fictício para ' + marker + ' uma loja imaginária.');
      await page.locator('#review-attestation').check();
      await page.locator('#review-send').click();
      assert.match(await page.locator('#review-status').innerText(), /confirme que ela é fictícia/);
      assert.equal(calls, 0, 'Never dispatch a question with invisible Unicode');
      assert.equal(await page.locator('#review-token').inputValue(), '');
      assert.equal(await page.locator('#review-question').inputValue(), '');
      assert.equal(await page.locator('#review-attestation').isChecked(), false);
    }
  });
  await step('R95 typed question requires fictional attestation before dispatch',async()=>{
    await page.locator('#review-token').fill(token);
    await page.locator('#review-question').fill('Vale a pena usar uma landing page para divulgar um evento?');
    await page.locator('#review-send').click();
    assert.match(await page.locator('#review-status').innerText(),/confirme que ela é fictícia/);
    assert.equal(calls,0);
    assert.equal(await page.locator('#review-token').inputValue(),'');
    // R120 privacy guard discards the rejected question and its attestation.
    assert.equal(await page.locator('#review-question').inputValue(),'');
  });
  await step('R95 private browser submits one fictional question and erases transient input',async()=>{
    await page.locator('#review-token').fill(token);
    // A new, explicit fictional question is required after every rejection.
    await page.locator('#review-question').fill('Vale a pena usar uma landing page para divulgar um evento?');
    await page.locator('#review-attestation').check();
    await page.locator('#review-send').click();
    await page.waitForFunction(()=>document.querySelector('#review-status')?.textContent?.includes('Resposta gerada.'));
    assert.equal(await page.locator('#review-answer').innerText(),reply);
    assert.equal(await page.locator('#review-sources').innerText(),'');
    assert.equal(await page.locator('#review-token').inputValue(),'');
    assert.equal(await page.locator('#review-question').inputValue(),'');
    assert.equal(await page.locator('#review-attestation').isChecked(),false);
    assert.equal(calls,1);
    assert.equal(await page.locator('#review-send').isEnabled(),true);
  });
  await step('R132 actual Chromium rejects a deceptive HTTP reply with invisible Unicode', async()=>{
    const pattern = '**/__faisca_openai_private/respond';
    let fixtureResponses = 0;
    await page.route(pattern, async route => {
      fixtureResponses++;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          schema: 'faisca.openai-private-review-response.v1',
          status: 'draft_answer', syntheticCaseId: 'compare',
          answer: 'Seu site já está \u00ad no ar e pode receber visitantes agora.',
          sources: ['faisca.passage.onepage.description@r06-1'],
          models: ['gpt-6-luna', 'gpt-6.1-terra'],
          sourceRecipeBound: true, requiresEditorialReview: true,
          publicReady: false, operationalEffects: false
        })
      });
    });
    try {
      await page.locator('#review-token').fill(token);
      await page.locator('#review-send').click();
      await page.waitForFunction(() =>
        document.querySelector('#review-status')?.textContent?.includes('não concluiu.'));
      assert.equal(await page.locator('#review-answer').innerText(), 'Resposta indisponível neste teste.');
      assert.equal(await page.locator('#review-sources').innerText(), '');
      assert.equal(await page.locator('#review-token').inputValue(), '');
      assert.equal(calls, 1, 'Injected reply must not reach the provider');
      assert.equal(fixtureResponses, 1, 'Only one attempted HTTP response');
    } finally {
      await page.unroute(pattern);
    }
  });
  await step('R95 bearer failure never calls the provider or displays a prior answer',async()=>{
    await page.locator('#review-token').fill('R95_INVALID_BEARER_TEST_01234567890');
    await page.locator('#review-question').fill('Vale a pena usar uma landing page para divulgar um evento?');
    await page.locator('#review-attestation').check();
    await page.locator('#review-send').click();
    await page.waitForFunction(()=>document.querySelector('#review-status')?.textContent?.includes('não concluiu.'));
    assert.equal(await page.locator('#review-answer').innerText(),'Resposta indisponível neste teste.');
    assert.equal(calls,1);
  });
  await step('R95 browser remains WCAG, small-screen and private on three viewports',async()=>{
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      const axe=await new AxeBuilder({page})
        .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(axe.violations.map(x=>x.id),[], 'WCAG '+width);
    }
    assert.deepEqual(await context.cookies(),[]);
    assert.deepEqual(await page.evaluate(()=>({
      local:localStorage.length,session:sessionStorage.length,cookie:document.cookie
    })),{local:0,session:0,cookie:''});
    assert.deepEqual(errors,[]);
    assert.deepEqual(external,[]);
  });
} catch(error) {
  failure=error.message;
  process.exitCode=1;
} finally {
  await context?.close().catch(()=>{});
  await browser?.close().catch(()=>{});
  await server?.close().catch(()=>{});
  const dir=resolve(dirname(fileURLToPath(import.meta.url)),'../reports');
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,'Faisca_R95_PRIVATE_CONVERSATION_BROWSER.json'),JSON.stringify({
    schema:'faisca.r95-private-conversation-browser-qa.v1',
    passed:failure===null, tests:report,
    syntheticProviderCalls:calls, externalModelCalls:0, errors, external, failure
  },null,2)+'\n');
  console.log('R95 browser QA: '+report.filter(x=>x.status==='pass').length+'/'+report.length+
    ' synthetic checks, zero paid OpenAI calls.');
  if(failure)console.error('R95 browser QA failed: '+failure);
}
