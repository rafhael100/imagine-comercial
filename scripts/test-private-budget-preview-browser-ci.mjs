/**
 * F157: Chromium + axe checks of local-only, non-submitting F156 budget
 * UI fixture. No server, no accounts, no storage, no real lead traffic.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {reviewLegacyBudgetPreviewParity} from '../src/lib/legacy-budget-parity.mjs';

const html=readFileSync(new URL('../tests/fixtures/private-contact-form-preview.html',import.meta.url),'utf8');
const review=reviewLegacyBudgetPreviewParity(html);
assert.equal(review.visibleFields,7,'F157 browser fixture must contain all seven legacy controls');
assert.equal(review.legacyContactIntakeParityApproved,false);
const controls=[
  ['lead-name','Nome para contato'],
  ['lead-role','Cargo na empresa'],
  ['lead-email','E-mail'],
  ['lead-phone','Telefone'],
  ['lead-mobile','Celular'],
  ['lead-details','O que você precisa'],
  ['lead-challenge','Verificação aritmética']
];
await mkdir('artifacts/browser',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:375,height:812,label:'mobile'},
    {width:1440,height:900,label:'desktop'}]){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
    const page=await context.newPage();
    const requests=[],errors=[];
    page.on('request',req=>requests.push(req.method()));
    page.on('pageerror',err=>errors.push(err.message));
    await page.setContent(html,{waitUntil:'load'});
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.locator('img.brand-mark').count(),1,
      'F266 real Imagine logo in private preview');
    assert.equal(await page.locator('img.brand-mark').evaluate(img=>
      img.complete&&img.naturalWidth===200&&img.naturalHeight===55),true,
      'F266 original Imagine image must decode without network');
    const primaryInk=await page.locator('h1').evaluate(node=>getComputedStyle(node).color);
    assert.equal(primaryInk,'rgb(23, 27, 25)',
      'F266 private quote copy uses approved Imagine graphite');

    assert.equal(await page.locator('dialog[open]').count(),1);
    assert.equal(await page.locator('form#private-budget-preview').count(),1);
    for(const [id,labelFragment] of controls){
      const input=page.locator('#'+id);
      assert.equal(await input.count(),1,'F157 '+id+' rendered '+viewport.label);
      assert.equal(await input.isVisible(),true,'F157 '+id+' visible '+viewport.label);
      assert.ok((await page.locator('label[for="'+id+'"]').textContent())?.includes(labelFragment),
        'F157 '+id+' has a visible label');
    }
    assert.equal(await page.locator('#lead-service').count(),1,
      'F157 extra curated service field remains available');
    const disabled=page.locator('form#private-budget-preview button[type="submit"]');
    assert.equal(await disabled.isDisabled(),true,'F157 no form submission in private preview');
    assert.equal(await page.locator('form#private-budget-preview').getAttribute('method'),'dialog');
    assert.match(await page.locator('#challenge-help').textContent(),/não verifica sua resposta/);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=2,'F157 no horizontal overflow at '+viewport.width+'px: '+overflow);
    const axe=await new AxeBuilder({page})
      .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],
      'F157 accessible private budget preview '+viewport.label);
    await page.screenshot({path:'artifacts/browser/private-budget-preview-'+viewport.label+'.png',
      fullPage:true});
    // Interaction is strictly with fictitious values in local DOM. No POST.
    await page.locator('#lead-name').fill('Pessoa Fictícia');
    await page.locator('#lead-role').fill('Responsável de exemplo');
    await page.locator('#lead-email').fill('ficticio@example.invalid');
    await page.locator('#lead-phone').fill('+550000000000');
    await page.locator('#lead-mobile').fill('');
    await page.locator('#lead-service').selectOption('onepage');
    await page.locator('#lead-details').fill('Projeto totalmente fictício de revisão da interface.');
    await page.locator('#lead-challenge').fill('5');
    assert.equal(await disabled.isDisabled(),true,
      'F157 fixture cannot be submitted after filling every field');
    assert.deepEqual(requests,[],'F157 no network requests during rendering/interactions');
    assert.deepEqual(errors,[],'F157 no browser errors');
    await context.close();
  }
  console.log('F157 Chromium/axe local-only budget UI: 7 legacy controls, mobile+desktop, submit disabled, zero requests.');
}finally{
  await browser.close();
}
