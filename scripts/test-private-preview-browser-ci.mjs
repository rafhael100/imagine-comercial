/**
 * F155 — browser E2E against authenticated, loopback-only F154 server.
 * Not remote staging; synthetic credentials only; no lead intake or external API.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createPrivateLoopbackPreview,listenPrivateLoopback} from '../src/lib/private-loopback-preview.mjs';
import {composeCuratedBriefingLinks} from '../src/data/briefing-curado.mjs';

const password='F155-CI-only-local-synthetic-token-2765';
const server=createPrivateLoopbackPreview({directory:'dist',password});
let browser;
try{
  const origin=await listenPrivateLoopback(server,0);
  browser=await chromium.launch({headless:true});
  const guest=await browser.newContext();
  const denied=await guest.request.get(origin+'/contato/');
  assert.equal(denied.status(),401,'F155 unauthenticated browser context cannot read contact');
  assert.equal(denied.headers()['x-robots-tag'],'noindex, nofollow, noarchive');
  await guest.close();

  const context=await browser.newContext({
    viewport:{width:375,height:812},
    httpCredentials:{username:'reviewer',password}
  });
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  const page=await context.newPage();
  const network=[],pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(err.message));
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.origin!==origin||request.method()!=='GET')
      network.push(request.method()+' '+url.origin);
  });
  const home=await page.goto(origin+'/',{waitUntil:'load'});
  assert.equal(home?.status(),200,'F155 authorized preview homepage');
  assert.equal(home?.headers()['x-robots-tag'],'noindex, nofollow, noarchive');
  assert.equal(home?.headers()['cache-control'],'private, no-store, max-age=0');
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('details.mobile-menu summary').isVisible(),true);
  await page.locator('details.mobile-menu summary').click();
  assert.equal(await page.locator('details.mobile-menu').getAttribute('open'),'');
  await page.locator('nav[aria-label="Navegação móvel"] a[href="/contato/"]').click();
  await page.waitForURL(origin+'/contato/');
  assert.equal(await page.locator('h1').count(),1);
  await page.locator('#service-choice').selectOption('onepage');
  await page.locator('#objective-choice').selectOption('melhorar-site');
  await page.locator('#stage-choice').selectOption('iniciando');
  await page.locator('#priority-choice').selectOption('contatos');
  const expected=composeCuratedBriefingLinks('onepage','melhorar-site','iniciando','contatos').message;
  assert.equal((await page.locator('#message-preview').textContent())?.trim(),
    'Prévia da mensagem: '+expected,'F155 reviewed message preview');
  const copy=page.locator('#copy-message');
  assert.equal(await copy.isVisible(),true,'F155 local clipboard should work in secure localhost context');
  await copy.click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected,
    'F155 clipboard contains only text selected from public reviewed catalogs');
  assert.match(await page.locator('#copy-message-status').textContent(),/Mensagem copiada/);
  await page.locator('#priority-choice').selectOption('');
  assert.equal(await page.locator('#copy-message-status').textContent(),'',
    'F155 changing selection clears copy confirmation');
  assert.deepEqual(pageErrors,[],'F155 authenticated preview should not have browser JS errors');
  assert.deepEqual(network,[],'F155 preview navigation must not emit cross-origin requests or POST');
  await context.close();
  console.log('F155 authenticated mobile browser QA passed: home, native menu, contact, curated copy, noindex and no external traffic; zero deploys.');
}finally{
  if(browser)await browser.close();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
}
