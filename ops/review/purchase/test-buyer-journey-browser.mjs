/**
 * Offline Chromium QA for F325 review artifact. No public URL or production
 * server: file:// only. Screenshots are synthetic, free of customer data.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const html=pathToFileURL(resolve('artifacts/review-f325-private-buyer-journey.html')).href;
await mkdir('artifacts/f325',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const width of [375,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  const outside=[],errors=[];
  page.on('request',req=>{if(!req.url().startsWith('file:'))outside.push(req.url().split('?')[0]);});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(html,{waitUntil:'load'});
  assert.match(await page.title(),/Prévia privada/);
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  assert.equal(await page.locator('button.primary[disabled]').count(),1);
  assert.equal(await page.locator('input[type="email"],input[type="password"],input[type="tel"]').count(),0);
  assert.match(await page.locator('#setup').textContent(),/990,00/);
  assert.match(await page.locator('#monthly').textContent(),/79,90/);
  await page.locator('button[data-offer="landing"]').click();
  assert.match(await page.locator('#setup').textContent(),/1\.290,00/);
  assert.match(await page.locator('#terms').textContent(),/430,00/);
  await page.locator('button[data-offer="performance"]').click();
  assert.equal(await page.locator('#channels').isVisible(),true);
  assert.match(await page.locator('#setup').textContent(),/980,00/);
  assert.match(await page.locator('#monthly').textContent(),/500,00/);
  assert.match(await page.locator('#media').textContent(),/2\.500,00/);
  await page.locator('#meta').uncheck();
  assert.match(await page.locator('#setup').textContent(),/490,00/);
  assert.match(await page.locator('#monthly').textContent(),/300,00/);
  await page.locator('#google-amount').fill('350');
  assert.equal(await page.locator('#error').isVisible(),true);
  assert.match(await page.locator('#error').textContent(),/mínimo/);
  await page.locator('#google-amount').fill('1000');
  await page.locator('#meta').check();
  await page.locator('#meta-amount').fill('700');
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.match(await page.locator('#monthly').textContent(),/370,00/);
  assert.match(await page.locator('#setup').textContent(),/980,00/);
  assert.match(await page.locator('#media').textContent(),/1\.700,00/);
  assert.equal(await page.locator('button.primary').isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,
   'No horizontal overflow at '+width);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  assert.deepEqual(axe.violations.map(v=>v.id),[], 'No WCAG violation at '+width);
  assert.deepEqual(outside,[],'No network requests at '+width);
  assert.deepEqual(errors,[],'No browser errors at '+width);
  await page.screenshot({path:'artifacts/f325/buyer-journey-'+width+'.png',fullPage:true});
  await context.close();
 }
}finally{await browser.close();}
console.log('PASS F325 offline interactive buyer journey 375/1440; no PII, network, checkout or payment');
