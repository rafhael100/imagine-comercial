/**
 * P0-F178: actual Chromium DOM -> signed proof GET -> authenticated
 * HTTP loopback -> CRM structural review (still NO intake/receipt).
 * Every value is synthetic and the real HTML submit remains disabled.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startPrivateBudgetReviewLab}
  from '../tests/fixtures/private-budget-http-review-harness.mjs';

const password='SYNTHETIC_F178_CHROMIUM_LOOPBACK_NO_CUSTOMER';
const fixture=readFileSync(
  new URL('../tests/fixtures/private-contact-form-preview.html',import.meta.url),'utf8');
const ids=[
 'bde4f010-aacf-4ad7-a302-94c507bb1111',
 'bde4f010-aacf-4ad7-a302-94c507bb2222',
 'bde4f010-aacf-4ad7-a302-94c507bb3333',
 'bde4f010-aacf-4ad7-a302-94c507bb4444',
 'bde4f010-aacf-4ad7-a302-94c507bb5555',
 'bde4f010-aacf-4ad7-a302-94c507bb6666'
];
const envelope={
  protocol:'imagine.lead-intake',schema_version:1,
  organization_reference:ids[0],binding_reference:ids[1],
  submission_reference:ids[2],site_reference:ids[3],
  form_reference:ids[4],destination_reference:ids[5]
};
const storedSnapshot={original:envelope,phase:'open',version:0};
const server=await startPrivateBudgetReviewLab(password,{requireRequestProof:true});
let browser;
try{
  const url=new URL(server.url),origin=url.origin;
  const issueUrl=origin+'/__lab/budget/request-proof';
  const previewUrl=origin+'/__lab/budget/preview-test-only';
  assert.equal((await fetch(issueUrl)).status,401,'P0-F178 anonymous cannot obtain a proof');
  browser=await chromium.launch({headless:true});
  for(const viewport of [
    {width:375,height:812,name:'mobile'},
    {width:1440,height:900,name:'desktop'}
  ]){
    const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
    const context=await browser.newContext({
      viewport:{width:viewport.width,height:viewport.height},
      extraHTTPHeaders:{Authorization:auth}
    });
    try{
      const page=await context.newPage(),requests=[],errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',req=>requests.push({
        origin:new URL(req.url()).origin,method:req.method()
      }));
      await page.route(previewUrl,route=>route.fulfill({
        status:200,contentType:'text/html; charset=utf-8',
        headers:{'X-Robots-Tag':'noindex, nofollow, noarchive',
          'Cache-Control':'private, no-store'},body:fixture
      }));
      assert.equal((await page.goto(previewUrl,{waitUntil:'load'})).status(),200);
      assert.equal(await page.locator('form#private-budget-preview button[type="submit"]').isDisabled(),true);
      await page.locator('#lead-name').fill('Pessoa Fictícia de Teste');
      await page.locator('#lead-role').fill('Revisão sintética');
      await page.locator('#lead-email').fill('test-proof@example.invalid');
      await page.locator('#lead-phone').fill('');
      await page.locator('#lead-mobile').fill('+5511999999999');
      await page.locator('#lead-service').selectOption('onepage');
      await page.locator('#lead-details').fill('Simulação integral sem qualquer contato ou cliente real.');
      await page.locator('#lead-challenge').fill('5');
      await page.locator('#preview-understanding').check();
      assert.equal(await page.locator('form#private-budget-preview').evaluate(f=>f.checkValidity()),true);
      const privateDraft=await page.locator('#private-budget-preview').evaluate(f=>{
        const v=id=>f.querySelector('#'+id).value;
        return {
          name:v('lead-name'),role:v('lead-role'),email:v('lead-email'),
          phone:v('lead-phone'),mobile:v('lead-mobile'),
          serviceSlug:v('lead-service'),details:v('lead-details'),
          challengePreview:v('lead-challenge'),
          previewUnderstanding:f.querySelector('#preview-understanding').checked
        };
      });
      const preview=await page.evaluate(async issueUrl=>{
        const r=await fetch(issueUrl,{method:'GET',credentials:'same-origin',redirect:'manual'});
        return {status:r.status,cache:r.headers.get('cache-control'),
          body:await r.json()};
      },issueUrl);
      assert.equal(preview.status,200);
      assert.equal(preview.cache,'private, no-store');
      assert.equal(preview.body.code,'SIGNED_ONE_TIME_LAB_PROOF_ISSUED');
      assert.match(preview.body.requestProof,/^v1\./);
      const send=async input=>page.evaluate(async({endpoint,input})=>{
        const r=await fetch(endpoint,{method:'POST',redirect:'manual',
          credentials:'same-origin',headers:{'Content-Type':'application/json'},
          body:JSON.stringify(input)});
        return {status:r.status,cache:r.headers.get('cache-control'),
          robots:r.headers.get('x-robots-tag'),body:await r.json()};
      },{endpoint:server.url,input});
      const base={privateDraft,envelope,storedSnapshot,expectedVersion:0};
      const withoutProof=await send(base);
      assert.equal(withoutProof.status,422);
      assert.equal(withoutProof.body.code,'PROOF_GATED_BODY_SHAPE_REQUIRED');
      const valid=await send({...base,requestProof:preview.body.requestProof});
      assert.equal(valid.status,200);
      assert.equal(valid.cache,'private, no-store');
      assert.equal(valid.robots,'noindex, nofollow, noarchive');
      assert.equal(valid.body.mode,'LAB_DIAGNOSTIC_NOT_RECEIPT');
      assert.equal(valid.body.reasonCode,'ATOMIC_STORE_REQUIRED');
      const replay=await send({...base,requestProof:preview.body.requestProof});
      assert.equal(replay.status,409);
      assert.equal(replay.body.code,'SIGNED_REQUEST_PROOF_REQUIRED_OR_USED');
      for(const output of [withoutProof,valid,replay]){
        assert.equal(output.body.canAcknowledgeVisitor,false);
        assert.equal(output.body.canSendToCrm,false);
        for(const secret of [privateDraft.email,privateDraft.name,
          privateDraft.details,ids[0],password,preview.body.requestProof])
          assert.equal(JSON.stringify(output.body).includes(secret),false,
            'P0-F178 HTTP replies must not echo any private field or proof');
      }
      assert.deepEqual(errors,[]);
      assert.ok(requests.every(x=>x.origin===origin));
      assert.equal(requests.filter(x=>x.method==='POST').length,3);
      assert.equal(await page.locator('form button[type="submit"]').isDisabled(),true);
      assert.deepEqual(await page.evaluate(()=>({
        cookie:document.cookie,local:localStorage.length,session:sessionStorage.length
      })),{cookie:'',local:0,session:0});
      console.log('P0-F178 '+viewport.name+': signed one-use HTTP lab without CRM receipt (NO-GO).');
    }finally{
      await context.close();
    }
  }
}finally{
  if(browser)await browser.close();
  await server.close();
}
