/**
 * P0-F162: real Chromium form -> authenticated HTTP loopback -> CRM structural
 * review. The HTML fixture has no script or enabled submit button. Only the
 * test runner explicitly sends SYNTHETIC values; no public intake endpoint.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startPrivateBudgetReviewLab}
  from '../tests/fixtures/private-budget-http-review-harness.mjs';
import {assessPrivateBudgetPreview}
  from '../src/lib/private-budget-preflight.mjs';

const password='SyntheticOnly_F162_Browser_NoCustomerSecrets';
const fixture=readFileSync(
  new URL('../tests/fixtures/private-contact-form-preview.html',import.meta.url),'utf8');
const uuids=Object.freeze([
 'bde4f010-aacf-4ad7-a302-94c507bb1111',
 'bde4f010-aacf-4ad7-a302-94c507bb2222',
 'bde4f010-aacf-4ad7-a302-94c507bb3333',
 'bde4f010-aacf-4ad7-a302-94c507bb4444',
 'bde4f010-aacf-4ad7-a302-94c507bb5555',
 'bde4f010-aacf-4ad7-a302-94c507bb6666'
]);
const envelope=Object.freeze({
 protocol:'imagine.lead-intake',schema_version:1,
 organization_reference:uuids[0],binding_reference:uuids[1],
 submission_reference:uuids[2],site_reference:uuids[3],
 form_reference:uuids[4],destination_reference:uuids[5]
});
const storedSnapshot={original:envelope,phase:'open',version:0};
const server=await startPrivateBudgetReviewLab(password);
let browser;
try{
  const endpoint=new URL(server.url),origin=endpoint.origin;
  const previewUrl=origin+'/__lab/budget/browser-only-fixture';
  browser=await chromium.launch({headless:true});
  for(const viewport of [
    {width:375,height:812,label:'mobile'},
    {width:1440,height:900,label:'desktop'}
  ]){
    const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
    const context=await browser.newContext({
      viewport:{width:viewport.width,height:viewport.height},
      extraHTTPHeaders:{Authorization:auth}
    });
    try{
      const page=await context.newPage(),external=[],errors=[],requests=[];
      await page.route(previewUrl,route=>route.fulfill({
        status:200,contentType:'text/html; charset=utf-8',
        headers:{'X-Robots-Tag':'noindex, nofollow, noarchive',
          'Cache-Control':'private, no-store'},
        body:fixture
      }));
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',request=>{
        const url=new URL(request.url());
        requests.push({origin:url.origin,method:request.method()});
        if(url.origin!==origin)external.push(url.origin);
      });
      const visual=await page.goto(previewUrl,{waitUntil:'load'});
      assert.equal(visual?.status(),200);
      assert.equal(await page.locator('form#private-budget-preview').count(),1);
      assert.equal(await page.locator('form#private-budget-preview button[type="submit"]').isDisabled(),
        true,'P0-F162 the real private HTML never enables public submission');
      assert.equal(await page.locator('input,select,textarea').count(),9);
      await page.locator('#lead-name').fill('Pessoa Inteiramente Fictícia');
      await page.locator('#lead-role').fill('Cargo de demonstração');
      await page.locator('#lead-email').fill('review@example.invalid');
      await page.locator('#lead-phone').fill('');
      await page.locator('#lead-mobile').fill('+5511999999999');
      await page.locator('#lead-service').selectOption('onepage');
      await page.locator('#lead-details').fill('Orçamento totalmente fictício para validar a infraestrutura de teste.');
      await page.locator('#lead-challenge').fill('5');
      await page.locator('#preview-understanding').check();
      assert.equal(await page.locator('form#private-budget-preview').evaluate(
        form=>form.checkValidity()),true);
      const privateDraft=await page.locator('form#private-budget-preview').evaluate(form=>{
        const field=id=>form.querySelector('#'+id).value;
        return {
          name:field('lead-name'),role:field('lead-role'),
          email:field('lead-email'),phone:field('lead-phone'),
          mobile:field('lead-mobile'),serviceSlug:field('lead-service'),
          details:field('lead-details'),challengePreview:field('lead-challenge'),
          previewUnderstanding:form.querySelector('#preview-understanding').checked
        };
      });
      const preflight=assessPrivateBudgetPreview(privateDraft);
      assert.equal(preflight.structureMatches,true);
      assert.equal(preflight.canSendToCrm,false);
      assert.equal(preflight.canAcknowledgeVisitor,false);

      // The DOM itself contains no fetch or submit handler. A *test-only*
      // interaction sends synthetic state to the real loopback HTTP server.
      const probe=async data=>page.evaluate(async({endpoint,body})=>{
        const response=await fetch(endpoint,{
          method:'POST',headers:{'Content-Type':'application/json'},
          credentials:'same-origin',redirect:'manual',body:JSON.stringify(body)
        });
        return {status:response.status,
          cache:response.headers.get('cache-control'),
          robots:response.headers.get('x-robots-tag'),
          body:await response.json()};
      },{endpoint:server.url,body:data});
      const accepted=await probe({
        privateDraft,envelope,storedSnapshot,expectedVersion:0
      });
      assert.equal(accepted.status,200);
      assert.equal(accepted.cache,'private, no-store');
      assert.equal(accepted.robots,'noindex, nofollow, noarchive');
      assert.equal(accepted.body.mode,'LAB_DIAGNOSTIC_NOT_RECEIPT');
      assert.equal(accepted.body.reasonCode,'ATOMIC_STORE_REQUIRED');
      for(const key of ['canAcknowledgeVisitor','canSendToCrm','canDeploy'])
        assert.equal(accepted.body[key],false);
      const invalid=await probe({
        privateDraft:{...privateDraft,email:'not-an-email'},envelope,
        storedSnapshot,expectedVersion:0
      });
      assert.equal(invalid.status,200);
      assert.equal(invalid.body.reasonCode,'INVALID_CONTACT_ROUTE');
      const stale=await probe({
        privateDraft,envelope,storedSnapshot,expectedVersion:2
      });
      assert.equal(stale.body.reasonCode,'STALE_SNAPSHOT_RECONCILE');
      const responses=[accepted,invalid,stale];
      for(const output of responses){
        const serialized=JSON.stringify(output);
        for(const forbidden of [privateDraft.name,privateDraft.email,
          privateDraft.details,uuids[0]])
          assert.equal(serialized.includes(forbidden),false,
            'P0-F162 never echoes a lead/tenant field in the diagnostic');
      }
      assert.deepEqual(external,[],'P0-F162 no offsite requests');
      assert.deepEqual(errors,[],'P0-F162 no JavaScript error');
      assert.equal(requests.filter(x=>x.method==='POST').length,3);
      assert.ok(requests.every(x=>x.origin===origin));
      assert.equal(await page.locator('form button[type="submit"]').isDisabled(),true);
      assert.deepEqual(await page.evaluate(()=>({
        cookie:document.cookie,local:localStorage.length,session:sessionStorage.length
      })),{cookie:'',local:0,session:0},
      'P0-F162 no local storage or cookies');
      console.log('P0-F162 '+viewport.label+': synthetic DOM -> HTTP review, no CRM receipt or public intake.');
    }finally{
      await context.close();
    }
  }
}finally{
  if(browser)await browser.close();
  await server.close();
}
