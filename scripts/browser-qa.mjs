/**
 * QA em navegador real executado somente contra 'astro preview' local.
 * Não testa autenticação, contas, checkout ou SEO real no Google.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { sitePages } from '../src/data/services.mjs';
import {guideGoals,guideForGoal} from '../src/lib/public-service-guide.mjs';
import { reviewPublicLinks } from '../src/lib/public-link-review.mjs';
import { resolvePortalLoginLink } from '../src/lib/portal-login-link.mjs';

const port = 4328;
const host = 'http://127.0.0.1:' + port;
const artifacts = 'artifacts/browser';
const approvedPortalLoginUrl=resolvePortalLoginLink(process.env.PUBLIC_PORTAL_LOGIN_URL || '');
const timeout = 45000;
let browser;
const server = spawn('node_modules/.bin/astro', ['preview', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, PUBLIC_PORTAL_LOGIN_URL:''}
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString().slice(-1000); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString().slice(-1000); });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitUntilReady() {
  for(let attempt=0;attempt<90;attempt++){
    if (server.exitCode !== null) throw new Error('Preview exited: ' + serverOutput);
    try {
      const response=await fetch(host+'/', {signal: AbortSignal.timeout(1500)});
      if (response.ok) return;
    }catch{}
    await sleep(500);
  }
  throw new Error('Preview not ready: '+serverOutput);
}

try {
  await waitUntilReady();
  browser=await chromium.launch({headless:true});
  await mkdir(artifacts,{recursive:true});

  for(const viewport of [{width:375,height:812,label:'mobile'},{width:1440,height:900,label:'desktop'}]){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];
    const unexpectedRequests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{
      if(request.method()!=='GET'||new URL(request.url()).origin!==host){
        // Keep only method and origin; never log URL query, email or PII.
        unexpectedRequests.push(request.method()+' '+new URL(request.url()).origin);
      }
    });
    const routes = viewport.label==='mobile'
      ? sitePages.map(p=>p.path)
      : ['/', '/servicos/', '/servicos/landing-pages/','/conteudos/','/contato/','/sobre/'];
    for(const route of routes) {
      console.log('Browser QA',viewport.label,route);
      const response=await page.goto(host+route,{waitUntil:'load',timeout});
      assert.equal(response?.status(),200,viewport.label+': '+route+' HTTP');
      assert.equal(await page.locator('h1').count(),1,viewport.label+': '+route+' single H1');
      assert.ok((await page.title()).trim().length>=15,viewport.label+': '+route+' title');
      assert.ok((await page.locator('meta[name="description"]').getAttribute('content'))?.length>=50,route+' description');
      const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');
      assert.equal(canonical,'https://imaginecomunicacao.com.br'+route,viewport.label+': '+route+' canonical');
      assert.equal(await page.locator('main#conteudo').count(),1,route+' main landmark');
      const portalLink=page.locator('a.nav-cta');
      assert.equal(await portalLink.count(),approvedPortalLoginUrl?1:0,
        viewport.label+': Portal link must match explicit approved build URL');
      if(approvedPortalLoginUrl) {
        assert.equal(await portalLink.getAttribute('href'),approvedPortalLoginUrl,
          viewport.label+': approved Portal link must be exact');
      }
      assert.equal(await page.locator('a[href="/servicos/"]').count()>=1,true,route+' internal service navigation');
      const anchors=await page.locator('a[href]').evaluateAll(elements=>elements.map(el=>({
        href:el.getAttribute('href'),target:el.getAttribute('target')||'',
        rel:el.getAttribute('rel')||''
      })));
      const fragmentIds=await page.locator('[id]').evaluateAll(elements=>elements.map(el=>el.id));
      const linkReport=reviewPublicLinks(anchors,{currentPath:route,fragmentIds,approvedPortalLoginUrl});
      assert.ok(linkReport.checked>=6,route+': expected connected internal navigation');

      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      if (overflow>2) {
        const offenders=await page.evaluate(() => [...document.querySelectorAll('body *')].map(el=>({
          tag:el.tagName.toLowerCase(),className:typeof el.className==='string'?el.className:'',
          text:(el.textContent||'').trim().slice(0,70),
          right:Math.round(el.getBoundingClientRect().right),
          width:Math.round(el.getBoundingClientRect().width)
        })).filter(el=>el.right>window.innerWidth+2).slice(0,12));
        throw new Error(viewport.label+': '+route+' horizontal overflow '+overflow+' elements='+JSON.stringify(offenders));
      }
      if(route==='/'||route==='/servicos/'||route==='/servicos/landing-pages/'||route==='/contato/') {
        const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        assert.deepEqual(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),[],viewport.label+': '+route+' axe');
        if(route==='/'||route==='/servicos/landing-pages/') {
          await page.screenshot({path:artifacts+'/'+viewport.label+'-'+(route==='/'?'home':'landing-page')+'.png',fullPage:true});
        }
      }
    }
    // F58: real browser contract for the public service guide.
    await page.goto(host+'/servicos/',{waitUntil:'load',timeout});
    const goalOptions=page.locator('#service-guide-goal option');
    assert.equal(await goalOptions.count(),guideGoals.length,'F58 all fixed choices rendered');
    assert.equal(await page.locator('#service-guide-goal').inputValue(),guideGoals[0].code);
    for(const item of guideGoals){
      await page.locator('#service-guide-goal').selectOption(item.code);
      const chosen=guideForGoal(item.code);
      assert.equal((await page.locator('#service-guide-explanation').textContent())?.trim(),
        chosen.explanation,viewport.label+' F58 explanation');
      assert.deepEqual(
        await page.locator('#service-guide-links a[data-service-guide-detail]').evaluateAll(links=>
          links.map(link=>({href:link.getAttribute('href'),label:link.textContent?.trim()}))),
        chosen.services.map(service=>({href:service.href,label:'Conhecer '+service.label})),
        viewport.label+' F58 reviewed internal suggestions'
      );
      assert.deepEqual(
        await page.locator('#service-guide-links a[data-service-guide-contact]').evaluateAll(links=>
          links.map(link=>({href:link.getAttribute('href'),label:link.textContent?.trim()}))),
        chosen.services.map(service=>({href:service.contactHref,label:'Solicitar proposta sobre '+service.label})),
        viewport.label+' F59 contact links remain scoped to selected service'
      );
    }
    // F59: a contact CTA carries only a service slug, no visitor identity.
    await page.locator('#service-guide-goal').selectOption('oferta');
    await page.locator('#service-guide-links a[data-service-guide-contact]').first().click();
    await page.waitForURL(host+'/contato/#landing-pages');
    assert.equal(await page.locator('#service-choice').inputValue(),'landing-pages');
    assert.ok((await page.locator('#contact-whatsapp').getAttribute('href'))?.includes('Landing%20Pages'));
    await page.goto(host+'/servicos/',{waitUntil:'load',timeout});
    await page.locator('#service-guide-goal').selectOption('anuncios');
    assert.equal(await page.locator('#service-guide-links a[data-service-guide-contact]').count(),2);
    await page.locator('#service-guide-links a[data-service-guide-contact]').last().click();
    await page.waitForURL(host+'/contato/#gestao-meta-ads');
    assert.equal(await page.locator('#service-choice').inputValue(),'gestao-meta-ads');
    assert.equal(await page.locator('#service-guide-results').count(),0,'guide does not leak across pages');
    assert.equal(await page.locator('#service-choice option').count(),7);
    assert.equal(await page.locator('#service-guide-results[aria-live="polite"]').count(),0);
    await page.goto(host+'/servicos/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('#service-guide-results[aria-live="polite"]').count(),1,
      'F58 output announces changes');
    // Without scripts, the original full service catalog remains navigable.
    if(viewport.label==='mobile'){
      const noJs=await browser.newContext({
        viewport:{width:375,height:812},javaScriptEnabled:false
      });
      try{
        const fallback=await noJs.newPage();
        await fallback.goto(host+'/servicos/',{waitUntil:'load',timeout});
        assert.equal(await fallback.locator('.cards article.card').count(),
          sitePages.filter(item=>item.path.startsWith('/servicos/')&&item.path!=='/servicos/').length,
          'F58 must preserve all public services without JavaScript');
        assert.equal(await fallback.locator('#service-guide-results a[href="/servicos/onepage/"]').count(),1,
          'F58 has a useful static initial recommendation');
      }finally{await noJs.close();}
    }
    // Jornada comercial: um clique deve manter o serviço de origem sem requisição ao Portal.
    await page.goto(host+'/servicos/landing-pages/',{waitUntil:'load',timeout});
    await page.locator('a.cta[href="/contato/#landing-pages"]').first().click();
    await page.waitForURL(host+'/contato/#landing-pages');
    assert.equal(await page.locator('#service-choice').inputValue(),'landing-pages','Contact intent is preselected');
    const wa=await page.locator('#contact-whatsapp').getAttribute('href');
    assert.equal(new URL(wa).searchParams.get('text')?.includes('Landing Pages'),true,'WhatsApp service context');
    const emailHref=await page.locator('#contact-email').getAttribute('href');
    assert.ok(emailHref?.includes(encodeURIComponent('Landing Pages')),'Email service context');
    await page.locator('#service-choice').selectOption('onepage');
    assert.ok((await page.locator('#contact-whatsapp').getAttribute('href'))?.includes('Onepage'),'Changing service updates CTA');
    // Controle de indexabilidade: caminhos inválidos devem retornar 404 real, não 200.
    const notFoundResponse=await page.goto(host+'/pagina-inexistente-de-teste-f11/',{waitUntil:'load',timeout});
    assert.equal(notFoundResponse?.status(),404,viewport.label+': missing route must return HTTP 404');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
    assert.equal(await page.locator('link[rel="canonical"]').count(),0,viewport.label+': error document has no canonical');
    assert.ok(await page.locator('a[href="/servicos/"]').count()>=1,viewport.label+': 404 navigates back to services');
    reviewPublicLinks(
      await page.locator('a[href]').evaluateAll(elements=>elements.map(el=>({
        href:el.getAttribute('href'),target:el.getAttribute('target')||'',
        rel:el.getAttribute('rel')||''
      }))),
      {currentPath:'/404/',fragmentIds:await page.locator('[id]').evaluateAll(elements=>elements.map(el=>el.id)),
       approvedPortalLoginUrl}
    );
    // F31 — no cookie, local/session storage, POST or third-party requests
    // may occur during an unapproved lead intake/CRM preview.
    const privacy=await page.evaluate(()=>({
      cookies:document.cookie,
      localStorageEntries:localStorage.length,
      sessionStorageEntries:sessionStorage.length
    }));
    assert.deepEqual(privacy,{cookies:'',localStorageEntries:0,sessionStorageEntries:0},
      viewport.label+': public site must not persist contact data or track visitors');
    assert.deepEqual(unexpectedRequests,[],
      viewport.label+': no external request or POST without approved consent/backend');
    assert.deepEqual(errors,[],viewport.label+' runtime errors');
    await context.close();
  }
  console.log('Browser QA passed:',sitePages.length,'mobile routes, 6 desktop routes, verified internal/external links and anchors, axe WCAG 2.1 A/AA for 3 pages per viewport.');
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
