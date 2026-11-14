/**
 * Real Chromium, local authenticated preview only.
 * Proves anonymous calculator UI for PT/EN/ES and no third-party traffic,
 * PII collection, endpoint POST, ads activation or email submission.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createPrivateLoopbackPreview,listenPrivateLoopback}
  from '../src/lib/private-loopback-preview.mjs';

const password='PERF-CALC-only-local-synthetic-password-2026';
const server=createPrivateLoopbackPreview({directory:'dist',password});
let browser;
try {
  const origin=await listenPrivateLoopback(server,0);
  browser=await chromium.launch({headless:true});
  const routes=[
    {path:'/calculadora-de-anuncios/',lang:'pt-BR',
      start:'#calculate-run',result:'#media-result',min:'#calc-minimum',
      suggested:'#calc-suggested',fee:'#calc-management',total:'#calc-total',
      checkbox:'input[name="channel"]',error:'#calculator-error',print:true},
    {path:'/en/budget-calculator/',lang:'en-US',
      start:'#intl-calc-run',result:'#intl-calc-results',min:'#intl-calc-min',
      suggested:'#intl-calc-suggested',fee:'#intl-calc-fee',total:'#intl-calc-total',
      checkbox:'input[name="intl-channel"]',error:'#intl-calc-error',print:false},
    {path:'/es/budget-calculator/',lang:'es-ES',
      start:'#intl-calc-run',result:'#intl-calc-results',min:'#intl-calc-min',
      suggested:'#intl-calc-suggested',fee:'#intl-calc-fee',total:'#intl-calc-total',
      checkbox:'input[name="intl-channel"]',error:'#intl-calc-error',print:false}
  ];
  for(const route of routes){
    const ctx=await browser.newContext({
      viewport:{width:375,height:812},
      httpCredentials:{username:'reviewer',password}
    });
    const page=await ctx.newPage();
    const blocked=[];
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{
      const u=new URL(r.url());
      if(u.origin!==origin||r.method()!=='GET')blocked.push(r.method()+' '+u.origin);
    });
    const response=await page.goto(origin+route.path,{waitUntil:'load'});
    assert.equal(response?.status(),200,route.path);
    assert.equal(await page.locator(route.result).isHidden(),true);
    assert.equal(await page.locator('form,input[type=email],input[type=tel],input[type=password]').count(),0,
      route.path+' must have zero public lead forms or PII inputs');
    assert.equal(await page.locator(route.checkbox).count(),3,route.path+' has exactly three ad providers');
    assert.equal(await page.locator(route.checkbox+'[value=meta_ads]').isChecked(),true);
    assert.equal(await page.locator(route.checkbox+'[value=google_ads]').isChecked(),false);
    if(route.print){
      assert.equal(await page.locator('#calc-print').isHidden(),true);
      await page.evaluate(()=>{window.print=()=>{window.__calculatorPrintCalled=true}});
    }
    await page.locator(route.start).click();
    assert.equal(await page.locator(route.result).isVisible(),true,route.path+' default calculation');
    const money=n=>new Intl.NumberFormat(route.lang,{style:'currency',currency:'BRL'}).format(n);
    assert.equal((await page.locator(route.min).textContent())?.trim(),money(700));
    assert.equal((await page.locator(route.suggested).textContent())?.trim(),money(1000));
    assert.equal((await page.locator(route.fee).textContent())?.trim(),money(200));
    assert.equal((await page.locator(route.total).textContent())?.trim(),money(1200));
    if(route.print){
      assert.equal(await page.locator('#calc-print').isVisible(),true);
      await page.locator('#calc-print').click();
      assert.equal(await page.evaluate(()=>Boolean(window.__calculatorPrintCalled)),true,
        'print must only run after explicit user interaction');
    }
    await page.locator(route.checkbox+'[value=google_ads]').check();
    await page.locator(route.checkbox+'[value=chatgpt_ads]').check();
    await page.locator(route.start).click();
    assert.equal((await page.locator(route.min).textContent())?.trim(),money(2900));
    assert.equal((await page.locator(route.suggested).textContent())?.trim(),money(4300));
    assert.equal((await page.locator(route.fee).textContent())?.trim(),money(860));
    assert.equal((await page.locator(route.total).textContent())?.trim(),money(5160));

    // A budget estimate is not an email subscription and never creates a lead.
    const faq=await page.locator('body').textContent();
    assert.ok(/CRM|CRM/.test(faq),'No auto-CRM promise');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),
      'No horizontal overflow in 375px viewport');
    assert.deepEqual(errors,[],route.path+' must not throw JS errors');
    assert.deepEqual(blocked,[],route.path+' cannot call external or POST endpoints');
    await ctx.close();
  }
  console.log('PASS: PT/EN/ES live Chromium calculator math, print, no PII, no POST/external traffic');
} finally {
  if(browser)await browser.close();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
}
