/**
 * QA em navegador real executado somente contra 'astro preview' local.
 * Não testa autenticação, contas, checkout ou SEO real no Google.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { sitePages } from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {articles} from '../src/data/articles.mjs';
import {relatedGuidesFor} from '../src/data/related-articles.mjs';
import {services} from '../src/data/services.mjs';
import {composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {composeCuratedBriefingLinks} from '../src/data/briefing-curado.mjs';
import {contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';
import {composeReviewedComparisonContact} from '../src/data/comparison-contact.mjs';
import {guideGoals,guideForGoal} from '../src/lib/public-service-guide.mjs';
import { reviewPublicLinks } from '../src/lib/public-link-review.mjs';
import { resolvePortalLoginLink } from '../src/lib/portal-login-link.mjs';
import {assessPrivateBudgetPreview} from '../src/lib/private-budget-preflight.mjs';

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
    // F151: local-only clipboard QA; does not grant network/storage permissions.
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:host});
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
      : ['/', '/servicos/', '/comparar-solucoes/','/como-funciona/','/perguntas-frequentes/', '/servicos/landing-pages/','/conteudos/','/contato/','/sobre/'];
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
      // F63: indicate current *page*, not an unrelated parent route.
      const navPages=new Set(['/servicos/','/comparar-solucoes/',
        '/servicos/landing-pages/','/conteudos/','/sobre/','/contato/']);
      const currentNav=page.locator('nav[aria-label="Navegação principal"] a[aria-current="page"]');
      if(navPages.has(route)){
        assert.equal(await currentNav.count(),1,route+': one current navigation link');
        assert.equal(await currentNav.first().getAttribute('href'),route,route+': active link destination');
      }else{
        assert.equal(await currentNav.count(),0,route+': no misleading current-page link');
      }
      assert.equal(await page.locator('nav[aria-label="Navegação principal"] a[href="/comparar-solucoes/"]').count(),1,
        route+': comparison is a permanent navigation destination');
      assert.equal(await page.locator('a.brand[aria-current="page"]').count(),route==='/'?1:0,
        route+': site logo denotes home only when current');
      // F150: mobile navigation is accessible with native details, no JS.
      const mobileSummary=page.locator('details.mobile-menu > summary');
      const desktopNav=page.locator('nav[aria-label="Navegação principal"]');
      assert.equal(await mobileSummary.isVisible(),viewport.label==='mobile',
        route+': mobile disclosure is only visible on small screens');
      assert.equal(await desktopNav.isVisible(),viewport.label==='desktop',
        route+': desktop navigation remains in the correct breakpoint');
      if(viewport.label==='mobile') {
        const mobileCurrent=page.locator('nav[aria-label="Navegação móvel"] a[aria-current="page"]');
        const mobilePages=new Set([...navPages,'/como-funciona/','/perguntas-frequentes/']);
        assert.equal(await mobileCurrent.count(),mobilePages.has(route)?1:0,
          route+': exact mobile active route');
      }

      if(route.startsWith('/servicos/') && route!=='/servicos/'){
        assert.equal(await page.locator('a.cta-secondary[href="/comparar-solucoes/"]').count(),1,
          'F62 service-page comparison link points to the actual comparison page');
      }
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
      if(route==='/'||route==='/servicos/'||route==='/comparar-solucoes/'||route==='/como-funciona/'||route==='/perguntas-frequentes/'||route==='/servicos/landing-pages/'||route==='/contato/'||route==='/conteudos/'||route==='/conteudos/landing-page-ou-site/') {
        const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        assert.deepEqual(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),[],viewport.label+': '+route+' axe');
        if(route==='/'||route==='/servicos/landing-pages/') {
          await page.screenshot({path:artifacts+'/'+viewport.label+'-'+(route==='/'?'home':'landing-page')+'.png',fullPage:true});
        }
      }
    }
    // F157: the real Astro preview must not activate any unapproved
    // migration or substitute the homepage as a soft 404.
    // The Workerd migration lab separately simulates candidate 301s ONLY
    // in its disposable directory; production rules remain in HOLD.
    if(viewport.label==='mobile'){
      const candidates=legacyUrls.filter(item=>item.status==='candidate');
      const held=legacyUrls.filter(item=>item.status==='hold');
      assert.equal(candidates.length,5);
      assert.equal(held.length,18);
      for(const legacy of [...candidates,...held]){
        const response=await page.goto(host+legacy.from,{waitUntil:'load',timeout});
        assert.equal(response?.status(),404,
          'F157 legacy path must stay unredirected in the review-only site');
        assert.equal(new URL(page.url()).pathname,legacy.from,
          'F157 legacy path must not redirect to an unrelated page');
        assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),
          'noindex,nofollow','F157 legacy 404 is not indexable');
        assert.equal(await page.locator('link[rel="canonical"]').count(),0,
          'F157 legacy 404 does not falsely claim a canonical');
        assert.equal(await page.locator('script[type="application/ld+json"]').count(),0,
          'F157 legacy 404 does not publish structured data');
        assert.ok((await page.locator('h1').textContent())?.includes('Não encontramos'));
        assert.equal(await page.locator('a[href="/servicos/"]').count()>=1,true);
      }
    }

    // F152: public topic navigation must filter locally and preserve SEO links.
    await page.goto(host+'/conteudos/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('#guide-list article.card').count(),articles.length);
    assert.equal(await page.locator('#guide-list article.card:visible').count(),articles.length);
    assert.equal(await page.locator('#guide-topic-filters button').count(),6);
    assert.equal(await page.locator('form,input,textarea').count(),0,
      'F152 filtering must not open public intake');
    const filterButton=code=>page.locator('[data-guide-filter="'+code+'"]');
    assert.equal(await filterButton('all').getAttribute('aria-pressed'),'true');
    await filterButton('anuncios').click();
    assert.equal(await page.locator('#guide-list article.card:visible').count(),1);
    assert.equal(await filterButton('anuncios').getAttribute('aria-pressed'),'true');
    assert.equal(await filterButton('all').getAttribute('aria-pressed'),'false');
    assert.match(await page.locator('#guide-filter-status').textContent(),/1 guia/);
    await filterButton('seo').click();
    assert.ok(await page.locator('#guide-list article.card:visible').count()>=2);
    await filterButton('landing-pages').focus();
    await page.keyboard.press('Enter');
    assert.equal(await filterButton('landing-pages').getAttribute('aria-pressed'),'true',
      'F158 editorial filters must work with keyboard');
    assert.ok(await page.locator('#guide-list article.card:visible').count()>=2);
    const filteredAccessibility=await new AxeBuilder({page})
      .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    assert.deepEqual(filteredAccessibility.violations.map(v=>({
      id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)
    })),[],viewport.label+': F158 filtered topic accessibility');
    await filterButton('all').click();
    assert.equal(await page.locator('#guide-list article.card:visible').count(),articles.length);
    assert.equal(await filterButton('all').getAttribute('aria-pressed'),'true');
    const filterOverflow=await page.evaluate(()=>
      document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(filterOverflow<=2,viewport.label+': F152 guide controls must not overflow');

    // F153: browser verifies native article outline navigation with no network.
    await page.goto(host+'/conteudos/landing-page-ou-site/',{waitUntil:'load',timeout});
    const outlineLinks=page.locator('nav[aria-label="Sumário deste guia"] a');
    const headingTargets=page.locator('article.guide article, article.section .guide-section');
    const editorial=articles.find(x=>x.slug==='landing-page-ou-site');
    assert.equal(await outlineLinks.count(),editorial.sections.length,
      'F153 each editorial section has one navigable anchor');
    assert.equal(await page.locator('.guide-section[id]').count(),editorial.sections.length);
    const firstSection=await outlineLinks.first().getAttribute('href');
    assert.match(firstSection,/^#[a-z0-9-]+$/);
    await outlineLinks.first().focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(host+'/conteudos/landing-page-ou-site/'+firstSection);
    assert.equal(await page.locator('.guide-section'+firstSection).count(),1,
      'F153 browser navigates to exact target ID');
    assert.equal(await page.locator('form,input,textarea').count(),0,
      'F153 section navigation does not collect visitor data');
    // F154: related editorial links are real, contextual and navigate locally.
    const editorialRelated=relatedGuidesFor(editorial.slug);
    assert.deepEqual(
      await page.locator('.related-reading a').evaluateAll(links=>links.map(link=>({
        href:link.getAttribute('href'),title:link.textContent?.trim()
      }))),
      editorialRelated.map(guide=>({href:guide.href,title:guide.title})),
      viewport.label+': F154 static editorial links'
    );
    await page.locator('.related-reading a').first().click();
    await page.waitForURL(host+editorialRelated[0].href);
    assert.equal(await page.locator('h1').count(),1,
      'F154 related article navigation retains a single visible H1');


    // F65: public FAQs require no client-side scripts or personal data.
    await page.goto(host+'/perguntas-frequentes/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('.faq-list').count(),4,'F65 four FAQ groups');
    assert.equal(await page.locator('.faq-item').count(),8,'F65 eight commercial questions');
    assert.equal(await page.locator('form,input,textarea').count(),0,
      'F65 FAQ must not gather visitor data');
    const firstFaq=page.locator('.faq-item').first();
    assert.equal(await firstFaq.getAttribute('open'),null);
    await firstFaq.locator('summary').click();
    assert.equal(await firstFaq.getAttribute('open'),'',
      'F65 native details expands on keyboard and pointer activation');
    assert.ok((await firstFaq.locator('p').textContent())?.length>90);
    // F64: process page keeps the public briefing self-service and static.
    await page.goto(host+'/como-funciona/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('.process-card').count(),6,'F64 six process stages');
    assert.equal(await page.locator('.process-card h3').count(),6);
    assert.equal(await page.locator('.process-card .process-question').count(),6);
    assert.equal(await page.locator('.briefing-list li').count(),6,'F64 preparation checklist');
    // F170: optional local preparation toggles make the existing public
    // checklist useful without collecting or saving responses.
    const checklist=page.locator('#briefing-list .briefing-toggle');
    assert.equal(await checklist.count(),6);
    assert.equal(await page.locator('#briefing-list .briefing-toggle:visible').count(),6);
    assert.match(await page.locator('#briefing-progress').textContent(),/0 de 6 perguntas preparadas/);
    const firstToggle=checklist.first();
    await firstToggle.click();
    assert.equal(await firstToggle.getAttribute('aria-pressed'),'true');
    assert.match(await page.locator('#briefing-progress').textContent(),/1 de 6 pergunta preparada/);
    assert.equal(await page.locator('[data-briefing-task][data-prepared="true"]').count(),1);
    await firstToggle.click();
    assert.equal(await firstToggle.getAttribute('aria-pressed'),'false');
    assert.match(await page.locator('#briefing-progress').textContent(),/0 de 6 perguntas preparadas/);
    await checklist.nth(2).click();
    await checklist.nth(4).click();
    assert.match(await page.locator('#briefing-progress').textContent(),/2 de 6 perguntas preparadas/);
    await page.evaluate(()=>{window.__testPrintCount=0;window.print=()=>{window.__testPrintCount++};});
    assert.equal(await page.locator('#print-briefing').isVisible(),true);
    await page.locator('#print-briefing').click();
    assert.equal(await page.evaluate(()=>window.__testPrintCount),1,'F170 print only by direct click');
    await page.reload({waitUntil:'load',timeout});
    assert.match(await page.locator('#briefing-progress').textContent(),/0 de 6 perguntas preparadas/,
      'F170 selections are ephemeral, never persisted');

    assert.equal(await page.locator('a[href="/comparar-solucoes/"]').count()>=1,true);
    assert.equal(await page.locator('a[href="/contato/"]').count()>=1,true);
    assert.equal(await page.locator('form,input,textarea').count(),0,
      'F64 guide does not collect visitors information');
    // F189: static FAQ section and question anchors work without storing
    // visitor input and without requiring JavaScript.
    await page.goto(host+'/perguntas-frequentes/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('nav.faq-index a[href^="#faq-"]').count(),4);
    assert.equal(await page.locator('nav.faq-index a[href^="#duvida-"]').count(),8);
    await page.locator('nav.faq-index a[href="#duvida-precos"]').click();
    await page.waitForURL(host+'/perguntas-frequentes/#duvida-precos');
    assert.equal(await page.locator('#duvida-precos details.faq-item').count(),1);
    await page.locator('#duvida-precos summary').click();
    assert.equal(await page.locator('#duvida-precos details').getAttribute('open'),'');
    assert.equal(await page.locator('nav.faq-index input').count(),0);
    await page.locator('a[href="#etapas"]').click();
    await page.waitForURL(host+'/como-funciona/#etapas');
    await page.goto(host+'/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('a[href="/como-funciona/"]').count()>=1,true,
      'F64 home links to project process');
    // F60: all six reviewed service comparisons are available even with
    // JS disabled and never send information to an unapproved backend.
    await page.goto(host+'/comparar-solucoes/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('.compare-card').count(),6,'F60 all six comparison cards');
    assert.equal(await page.locator('.compare-card dl').count(),6);
    assert.equal(await page.locator('.compare-card dt').count(),18,'F60 three decision criteria each');
    assert.equal(await page.locator('.compare-card a[href^="/servicos/"]').count(),6);
    assert.equal(await page.locator('.compare-card a[href^="/contato/#"]').count(),6);
    assert.equal(await page.locator('a[href="#comparacoes"]').count(),1);
    // F174: local shortlist of two reviewed services, no network/storage.
    assert.equal(await page.locator('[data-compare-select]').count(),6);
    assert.equal(await page.locator('#selected-comparison').isVisible(),false);
    await page.locator('[data-compare-select="onepage"]').click();
    assert.equal(await page.locator('#selected-comparison-list li').count(),1);
    assert.equal(await page.locator('[data-compare-select="onepage"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-compare-select="landing-pages"]').click();
    assert.equal(await page.locator('#selected-comparison-list li').count(),2,
      'F174 selected exactly two real services');
    assert.match(await page.locator('#compare-chooser-status').textContent(),/2 soluções selecionadas/);
    assert.equal(await page.locator('[data-compare-select="gestao-google-ads"]').isDisabled(),true,
      'F174 never accepts a third selected service');
    assert.equal(await page.locator('#selected-comparison-list a[href="/contato/#onepage"]').count(),1);
    assert.equal(await page.locator('#selected-comparison-list a[href="/contato/#landing-pages"]').count(),1);
    // F188: two public choices lead only to visitor-controlled external links.
    const pairContact=composeReviewedComparisonContact(['onepage','landing-pages']);
    assert.equal(await page.locator('#contact-comparison-whatsapp').getAttribute('href'),
      contactWhatsAppUrl(pairContact.message));
    assert.equal(await page.locator('#contact-comparison-email').getAttribute('href'),
      contactEmailUrl(pairContact.subject,pairContact.message));
    assert.equal(await page.locator('#contact-comparison-whatsapp').isVisible(),true);
    assert.equal(await page.locator('#comparison-channel-disclosure').isVisible(),true);
    // F175: share exactly two reviewed slugs, restore after reload, and
    // reject arbitrary visitor text or altered fragments without a request.
    const shareComparison=page.locator('#copy-comparison-link');
    assert.equal(await shareComparison.isVisible(),true);
    await shareComparison.click();
    const comparisonLink=await page.evaluate(()=>navigator.clipboard.readText());
    assert.equal(comparisonLink,host+'/comparar-solucoes/#comparar:onepage:landing-pages');
    assert.match(await page.locator('#copy-comparison-status').textContent(),
      /Link da comparação copiado/);
    await page.reload({waitUntil:'load',timeout});
    assert.equal(await page.locator('#selected-comparison-list li').count(),2,
      'F175 valid two-service link restores comparison after reload');
    await page.goto(host+'/comparar-solucoes/#comparar:onepage:EXFILTRATION',{waitUntil:'load',timeout});
    assert.equal(await page.locator('#selected-comparison').isVisible(),false,
      'F175 malformed comparison fragments must fail closed');
    await page.goto(comparisonLink,{waitUntil:'load',timeout});
    assert.equal(await page.locator('#selected-comparison-list li').count(),2);
    await page.locator('[data-compare-select="onepage"]').click();
    assert.equal(await page.locator('#selected-comparison-list li').count(),1);
    assert.equal(await page.locator('[data-compare-select="gestao-google-ads"]').isEnabled(),true);
    await page.locator('[data-compare-select="landing-pages"]').click();
    assert.equal(await page.locator('#selected-comparison-list li').count(),0);
    assert.equal(await page.locator('#selected-comparison').isVisible(),false);
    await page.locator('.compare-card a[href="/contato/#landing-pages"]').click();
    await page.waitForURL(host+'/contato/#landing-pages');
    assert.equal(await page.locator('#service-choice').inputValue(),'landing-pages',
      'F60 comparison contact must retain only public service intent');
    await page.goto(host+'/servicos/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('a[href="/comparar-solucoes/"]').count()>=1,true,
      'F60 comparison linked from service directory');
    // F145: contextual editorial conversion keeps only an approved service slug.
    await page.goto(host+'/conteudos/landing-page-ou-site/',{waitUntil:'load',timeout});
    assert.equal(await page.locator('a.cta[href="/contato/#criacao-de-sites/"]').count(),0,
      'F145 canonical contact hash never adds a slash after the service slug');
    assert.equal(await page.locator('a.cta[href="/contato/#criacao-de-sites"]').count(),1,
      'F145 article CTA must use a reviewed service hash');
    assert.equal(await page.locator('a[href="/contato/"]').count()>=1,true,
      'F145 keeps an accessible generic contact fallback');
    await page.locator('a.cta[href="/contato/#criacao-de-sites"]').click();
    await page.waitForURL(host+'/contato/#criacao-de-sites');
    assert.equal(await page.locator('#service-choice').inputValue(),'criacao-de-sites',
      'F145 article visitor arrives with reviewed service preselected');
    // F63: keyboard's first stop is the visible skip-to-content control.
    await page.goto(host+'/',{waitUntil:'load',timeout});
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('a.skip-link').evaluate(el=>el===document.activeElement),true,
      'F63 first keyboard focus must be skip-to-content link');
    assert.equal(await page.locator('a.skip-link:focus-visible').count(),1,
      'F63 skip link must be visible when keyboard focused');
    if(viewport.label==='mobile'){
      // F150: disclosure can be opened by keyboard and its links navigate.
      await page.goto(host+'/',{waitUntil:'load',timeout});
      const summary=page.locator('details.mobile-menu > summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('details.mobile-menu').getAttribute('open'),'',
        'F150 Enter opens native mobile menu');
      await page.locator('nav[aria-label="Navegação móvel"] a[href="/comparar-solucoes/"]').click();
      await page.waitForURL(host+'/comparar-solucoes/');
      assert.equal(await page.locator('nav[aria-label="Navegação móvel"] a[aria-current="page"]').count(),1);
      await page.goto(host+'/',{waitUntil:'load',timeout});
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
        await fallback.goto(host+'/comparar-solucoes/',{waitUntil:'load',timeout});
        assert.equal(await fallback.locator('#comparacoes .compare-card').count(),6,
          'F174 all six comparison cards stay visible without JavaScript');
        assert.equal(await fallback.locator('[data-compare-select]:visible').count(),0,
          'F174 shortlist buttons are hidden without JavaScript');
        assert.equal(await fallback.locator('#copy-comparison-link').isVisible(),false,
          'F175 share link stays hidden without JavaScript');
        assert.equal(await fallback.locator('#selected-comparison').isVisible(),false);
        assert.equal(await fallback.locator('#contact-comparison-whatsapp').isVisible(),false,
          'F188 no-JS external pair enhancement remains hidden');
        await fallback.goto(host+'/perguntas-frequentes/',{waitUntil:'load',timeout});
        assert.equal(await fallback.locator('.faq-index a[href^="#duvida-"]').count(),8,
          'F189 no-JS question navigation works');
        await fallback.locator('.faq-index a[href="#duvida-precos"]').click();
        await fallback.waitForURL(host+'/perguntas-frequentes/#duvida-precos');
        assert.equal(await fallback.locator('#duvida-precos summary').count(),1);
        await fallback.goto(host+'/conteudos/',{waitUntil:'load',timeout});
        assert.equal(await fallback.locator('#guide-list article.card:visible').count(),
          articles.length,'F152 all guides remain usable without JavaScript');
        assert.equal(await fallback.locator('#guide-topic-filters').isVisible(),
          false,'F152 inactive filter controls remain hidden without JavaScript');
        await fallback.goto(host+'/conteudos/landing-page-ou-site/',{waitUntil:'load',timeout});
        assert.equal(await fallback.locator('nav[aria-label="Sumário deste guia"] a').count(),
          articles.find(x=>x.slug==='landing-page-ou-site').sections.length,
          'F153 native outline remains usable without JavaScript');
        assert.equal(await fallback.locator('.related-reading a').count(),2,
          'F154 related guides remain visible without JavaScript');
        await fallback.goto(host+'/como-funciona/',{waitUntil:'load',timeout});
        assert.equal(await fallback.locator('#briefing-list .briefing-task').count(),6);
        assert.equal(await fallback.locator('.briefing-toggle:visible').count(),0,
          'F170 no-JS checklist remains readable and inert');
        assert.equal(await fallback.locator('#print-briefing').isVisible(),false,
          'F170 print enhancement stays hidden without JavaScript');
        await fallback.goto(host+'/contato/',{waitUntil:'load',timeout});
        assert.equal(await fallback.locator('#external-channel-notice').isVisible(),true,
          'F72 disclosure exists without JavaScript');
        assert.equal(await fallback.locator('a#contact-whatsapp').count(),1,
          'F72 WhatsApp link retains default no-JS href');
        assert.equal(await fallback.locator('a#contact-email').count(),1,
          'F72 email link retains default no-JS href');
        assert.equal(await fallback.locator('#copy-message').isVisible(),false,
          'F151 copy action stays hidden without JavaScript');
        assert.equal(await fallback.locator('#copy-briefing-link').isVisible(),false,
          'F169 share action stays hidden without JavaScript');

        await fallback.goto(host+'/',{waitUntil:'load',timeout});
        const nativeMenu=fallback.locator('details.mobile-menu');
        assert.equal(await nativeMenu.locator('summary').isVisible(),true,
          'F150 no-JS mobile menu visible');
        await nativeMenu.locator('summary').click();
        assert.equal(await nativeMenu.getAttribute('open'),'',
          'F150 no-JS disclosure opens without scripts');
        await nativeMenu.locator('a[href="/contato/"]').click();
        await fallback.waitForURL(host+'/contato/');
        assert.equal(await fallback.locator('h1').count(),1,
          'F150 no-JS navigation reaches contact');

        // F75: direct service channels must work even when client scripts are disabled.
        for(const service of services){
          await fallback.goto(host+'/servicos/'+service.slug+'/',{waitUntil:'load',timeout});
          const intent=composeCuratedContactLinks(service.slug);
          assert.equal(await fallback.locator('a[data-service-whatsapp]').getAttribute('href'),
            contactWhatsAppUrl(intent.message),'F75 no-JS WhatsApp '+service.slug);
          assert.equal(await fallback.locator('a[data-service-email]').getAttribute('href'),
            contactEmailUrl(intent.subject),'F75 no-JS email '+service.slug);
          assert.equal(await fallback.locator('#service-whatsapp-notice').isVisible(),true);
        }
      }finally{await noJs.close();}
    }
    // F75: validate all six service-specific contact channels in a real browser.
    // Reading href attributes never opens external applications or transmits a lead.
    for(const service of services){
      await page.goto(host+'/servicos/'+service.slug+'/',{waitUntil:'load',timeout});
      const intent=composeCuratedContactLinks(service.slug);
      const waLink=page.locator('a[data-service-whatsapp]');
      const emailLink=page.locator('a[data-service-email]');
      assert.equal(await waLink.count(),1,viewport.label+': '+service.slug+' WhatsApp CTA');
      assert.equal(await emailLink.count(),1,viewport.label+': '+service.slug+' email CTA');
      assert.equal(await waLink.getAttribute('href'),contactWhatsAppUrl(intent.message),
        viewport.label+': '+service.slug+' exact curated WhatsApp URL');
      assert.equal(await emailLink.getAttribute('href'),contactEmailUrl(intent.subject),
        viewport.label+': '+service.slug+' exact curated mailto URL');
      assert.equal(await waLink.getAttribute('target'),'_blank');
      assert.equal(await waLink.getAttribute('rel'),'noopener noreferrer');
      assert.equal(await waLink.getAttribute('aria-describedby'),'service-whatsapp-notice');
      assert.equal(await emailLink.getAttribute('aria-describedby'),'service-whatsapp-notice');
      const notice=page.locator('#service-whatsapp-notice');
      assert.equal(await notice.isVisible(),true,viewport.label+': channel notice visible');
      assert.ok((await notice.textContent())?.includes('revise e confirme o envio'));
      assert.equal(await page.locator('form,input,textarea').count(),0);
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
    // F71: public goal selection complements service intent without placing
    // visitor choices in URL, cookies or a backend request.
    await page.locator('#objective-choice').selectOption('melhorar-site');
    const goalWhatsapp=await page.locator('#contact-whatsapp').getAttribute('href');
    assert.ok(new URL(goalWhatsapp).searchParams.get('text')?.includes('Melhorar um site existente'),
      'F71 WhatsApp message includes the approved public goal');
    assert.ok(new URL(goalWhatsapp).searchParams.get('text')?.includes('Onepage'),
      'F71 WhatsApp message retains the selected service');
    const goalEmail=await page.locator('#contact-email').getAttribute('href');
    assert.ok(new URL(goalEmail).searchParams.get('subject')?.includes('Melhorar um site existente'),
      'F71 email subject includes only the selected public goal');
    // F142: real-browser proof that curated briefing changes only outbound hrefs
    // and accessible local preview; no external request is issued.
    await page.locator('#stage-choice').selectOption('iniciando');
    await page.locator('#priority-choice').selectOption('contatos');
    const briefing=composeCuratedBriefingLinks('onepage','melhorar-site','iniciando','contatos');
    const preparedWhatsapp=await page.locator('#contact-whatsapp').getAttribute('href');
    const preparedEmail=await page.locator('#contact-email').getAttribute('href');
    assert.equal(new URL(preparedWhatsapp).searchParams.get('text'),briefing.message,
      'F142 exact curated WhatsApp message '+viewport.label);
    assert.equal(new URL(preparedEmail).searchParams.get('body'),briefing.message,
      'F142 exact curated mailto body '+viewport.label);
    assert.equal((await page.locator('#message-preview').textContent())?.trim(),
      'Prévia da mensagem: '+briefing.message,'F142 accessible preview '+viewport.label);
    // F151: a deliberate click copies exactly the predefined, local message.
    const copyButton=page.locator('#copy-message');
    assert.equal(await copyButton.isVisible(),true,'F151 clipboard action offered when supported');
    assert.equal(await page.locator('#copy-message-status').textContent(),'');
    await copyButton.click();
    const clipboardText=await page.evaluate(()=>navigator.clipboard.readText());
    assert.equal(clipboardText,briefing.message,'F151 clipboard contains only curated briefing');
    assert.ok((await page.locator('#copy-message-status').textContent())?.includes('Mensagem copiada'));
    // F169: the user may deliberately share only public catalog identifiers.
    // Copy must strip current URL queries and must never transmit a lead.
    const shareButton=page.locator('#copy-briefing-link');
    assert.equal(await shareButton.isVisible(),true,'F169 share is available with clipboard');
    await shareButton.click();
    const sharedUrl=await page.evaluate(()=>navigator.clipboard.readText());
    assert.equal(sharedUrl,host+'/contato/#briefing:onepage:melhorar-site:iniciando:contatos');
    assert.equal(new URL(page.url()).hash,'#onepage',
      'F169 copying link must not alter current history or trigger navigation');
    assert.match(await page.locator('#copy-briefing-status').textContent(),/Link do briefing copiado/);
    const sharedPage=await context.newPage();
    try{
      await sharedPage.goto(sharedUrl,{waitUntil:'load',timeout});
      assert.equal(await sharedPage.locator('#service-choice').inputValue(),'onepage');
      assert.equal(await sharedPage.locator('#objective-choice').inputValue(),'melhorar-site');
      assert.equal(await sharedPage.locator('#stage-choice').inputValue(),'iniciando');
      assert.equal(await sharedPage.locator('#priority-choice').inputValue(),'contatos');
      const sharedHref=await sharedPage.locator('#contact-whatsapp').getAttribute('href');
      assert.equal(new URL(sharedHref).searchParams.get('text'),briefing.message);
      await sharedPage.goto(host+'/contato/#briefing:onepage:EXFILTRATION:iniciando:contatos',
        {waitUntil:'load',timeout});
      for(const selector of ['#service-choice','#objective-choice','#stage-choice','#priority-choice'])
        assert.equal(await sharedPage.locator(selector).inputValue(),'',
          'F169 malformed public link fails closed');
    }finally{await sharedPage.close();}
    // F173: browser clipboard writes are asynchronous. If the visitor
    // changes any choice before an old promise settles, no stale message
    // or share-link confirmation may be shown. Both buttons stay disabled
    // during the pending write to prevent concurrent writes and wrong paste.
    await page.evaluate(()=>{
      window.__delayedClipboard=[];
      Object.defineProperty(navigator.clipboard,'writeText',{
        configurable:true,value:text=>new Promise((resolve,reject)=>{
          window.__delayedClipboard.push({text,resolve,reject});
        })
      });
    });
    await copyButton.click();
    await page.waitForFunction(()=>window.__delayedClipboard?.length===1);
    assert.equal(await copyButton.isDisabled(),true,'F173 prevent concurrent message writes');
    assert.equal(await shareButton.isDisabled(),true,'F173 prevent concurrent link writes');
    await page.locator('#priority-choice').selectOption('oferta');
    await page.evaluate(()=>window.__delayedClipboard.shift().resolve());
    await page.waitForFunction(()=>!document.querySelector('#copy-message').disabled);
    assert.equal(await page.locator('#copy-message-status').textContent(),'',
      'F173 stale clipboard success must not confirm changed briefing');
    assert.equal(await page.locator('#copy-briefing-status').textContent(),'');
    await page.locator('#priority-choice').selectOption('contatos');
    await shareButton.click();
    await page.waitForFunction(()=>window.__delayedClipboard?.length===1);
    assert.equal(await copyButton.isDisabled(),true);
    await page.locator('#stage-choice').selectOption('evoluindo');
    await page.evaluate(()=>window.__delayedClipboard.shift().reject(
      new Error('Synthetic rejected clipboard write')));
    await page.waitForFunction(()=>!document.querySelector('#copy-briefing-link').disabled);
    assert.equal(await page.locator('#copy-briefing-status').textContent(),'',
      'F173 old copy failure must not obscure new briefing');
    await page.locator('#stage-choice').selectOption('iniciando');
    await shareButton.click();
    await page.waitForFunction(()=>window.__delayedClipboard?.length===1);
    await page.evaluate(()=>window.__delayedClipboard.shift().resolve());
    await page.waitForFunction(()=>!document.querySelector('#copy-briefing-link').disabled);
    assert.match(await page.locator('#copy-briefing-status').textContent(),
      /Link do briefing copiado/,'F173 current choice gets valid confirmation');
    await page.evaluate(()=>{
      delete navigator.clipboard.writeText;
      delete window.__delayedClipboard;
    });
    await page.locator('#priority-choice').selectOption('presenca');
    assert.equal(await page.locator('#copy-briefing-status').textContent(),'',
      'F169 changing choice clears stale share confirmation');
    assert.equal(await page.locator('#copy-message-status').textContent(),'',
      'F151 changing choices clears stale copy confirmation');

    await page.evaluate(()=>{
      const el=document.querySelector('#priority-choice');
      el.value='not-a-public-choice';
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    assert.equal(await page.locator('#priority-choice').inputValue(),'',
      'F142 rejects non-curated priority');
    await page.locator('#stage-choice').selectOption('');
    assert.equal(new URL(await page.locator('#contact-email').getAttribute('href')).searchParams.get('body'),
      null,'F142 email fallback has no unrequested body');

    assert.equal(new URL(page.url()).hash,'#onepage',
      'F71 URL fragment remains service-only, no visitor objective');
    assert.ok((await page.locator('#objective-help').textContent())?.includes('Melhorar um site existente'));
    await page.evaluate(()=>{
      const el=document.querySelector('#objective-choice');
      el.value='injected-visitor-data';
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    assert.equal(await page.locator('#objective-choice').inputValue(),'',
      'F71 arbitrary objective must be cleared');
    assert.equal(new URL(page.url()).hash,'#onepage');
    assert.ok(!(new URL(await page.locator('#contact-whatsapp').getAttribute('href'))).searchParams
      .get('text')?.includes('injected-visitor-data'));
    await page.locator('#objective-choice').selectOption('campanhas');
    assert.equal(await page.locator('#objective-help[role="status"][aria-live="polite"]').count(),1);
    // F72: visitor sees the real handoff boundary before leaving the site.
    const disclosure=page.locator('#external-channel-notice');
    assert.equal(await disclosure.isVisible(),true,'F72 channel disclosure is visible');
    assert.ok((await disclosure.textContent())?.includes('canais abaixo são externos ao site'));
    assert.equal(await page.locator('#contact-whatsapp[aria-describedby="external-channel-notice"]').count(),1);
    assert.equal(await page.locator('#contact-email[aria-describedby="external-channel-notice"]').count(),1);
    assert.equal(await page.locator('#contact-whatsapp').getAttribute('target'),'_blank');
    assert.ok((await page.locator('#contact-whatsapp').getAttribute('rel'))?.includes('noopener'));
    // F62: the address and prepared message must stay in sync when a user
    // changes the selector, follows a deep link, or navigates browser history.
    await page.waitForURL(host+'/contato/#onepage');
    assert.ok((await page.locator('#service-help').textContent())?.includes('Onepage'),
      'F62 accessible status reflects the selected service');
    assert.equal(await page.locator('#service-choice[aria-describedby="service-help"]').count(),1);
    await page.evaluate(()=>{window.location.hash='#gestao-google-ads';});
    await page.waitForFunction(()=>document.querySelector('#service-choice')?.value==='gestao-google-ads');
    assert.ok((await page.locator('#contact-email').getAttribute('href'))?.includes(
      encodeURIComponent('Gestão Google Ads')),'F62 hashchange updates subject');
    await page.evaluate(()=>{window.location.hash='#__proto__';});
    await page.waitForFunction(()=>document.querySelector('#service-choice')?.value==='');
    assert.ok((await page.locator('#contact-whatsapp').getAttribute('href'))?.includes(
      encodeURIComponent('conhecer os serviços da Imagine')),
      'F62 invalid fragment cannot create arbitrary intent');
    await page.locator('#service-choice').selectOption('landing-pages');
    await page.waitForURL(host+'/contato/#landing-pages');
    await page.locator('#service-choice').selectOption('');
    await page.waitForURL(host+'/contato/');
    assert.equal(await page.locator('#service-choice').inputValue(),'');
    assert.equal(await page.locator('#service-help[role="status"][aria-live="polite"]').count(),1);
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
  // F82: PRIVATE fixture only, loaded in memory; never a public Astro route.
  const privateFormSource=readFileSync(new URL('../tests/fixtures/private-contact-form-preview.html',import.meta.url),'utf8');
  assert.doesNotMatch(privateFormSource,/<script\b|\baction=|fetch\s*\(|https?:\/\//i,
    'F82 fixture must not include client scripts, submission endpoints or remote dependencies');
  for(const viewport of [{width:375,height:812,label:'mobile'},{width:1440,height:900,label:'desktop'}]){
    const ctx=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
    try{
      const p=await ctx.newPage();
      const requests=[];
      p.on('request',request=>requests.push(request.method()));
      await p.setContent(privateFormSource,{waitUntil:'load'});
      assert.equal(await p.locator('form#private-budget-preview[method="dialog"]').count(),1);
      assert.equal(await p.locator('form button[type="submit"]:disabled').count(),1);
      assert.equal(await p.locator('input#lead-name:required').count(),1);
      assert.equal(await p.locator('select#lead-service:required').count(),1);
      assert.equal(await p.locator('textarea#lead-details:required').count(),1);
      assert.equal(await p.locator('#preview-understanding:required').count(),1);
      assert.equal(await p.locator('form').evaluate(form=>form.checkValidity()),false);
      await p.locator('#lead-name').fill('Cliente Fictício');
      assert.equal(await p.locator('#lead-role').count(),1);
      assert.equal(await p.locator('#lead-mobile').count(),1);
      await p.locator('#lead-role').fill('Gestão fictícia');
      await p.locator('#lead-mobile').fill('+5511999999999');
      assert.equal(await p.locator('#lead-role').getAttribute('required'),null);
      assert.equal(await p.locator('#lead-mobile').getAttribute('required'),null);
      await p.locator('#lead-email').fill('not-an-email');
      await p.locator('#lead-service').selectOption('landing-pages');
      await p.locator('#lead-details').fill('Projeto inteiramente fictício para ensaiar o fluxo.');
      await p.locator('#preview-understanding').check();
      assert.equal(await p.locator('form').evaluate(form=>form.checkValidity()),false,
        'F82 native email validation must reject malformed syntactic input');
      await p.locator('#lead-email').fill('cliente@example.test');
      assert.equal(await p.locator('form').evaluate(form=>form.checkValidity()),true,
        'F82 HTML structural validation is never proof of consent or delivery');

      // P0 F158 — the ACTUAL private form controls, read in Chromium,
      // must match the server-side structural preflight. Neither branch
      // submits a contact, stores PII or grants consent/CRM authority.
      const draftFromPrivateBrowser=await p.locator('form#private-budget-preview').evaluate(form=>{
        const value=id=>form.querySelector('#'+id).value;
        return {
          name:value('lead-name'),role:value('lead-role'),
          email:value('lead-email'),phone:value('lead-phone'),
          mobile:value('lead-mobile'),serviceSlug:value('lead-service'),
          details:value('lead-details'),
          challengePreview:value('lead-challenge'),
          previewUnderstanding:form.querySelector('#preview-understanding').checked
        };
      });
      const preflight=assessPrivateBudgetPreview(draftFromPrivateBrowser);
      assert.equal(preflight.code,'STRUCTURAL_PREVIEW_ONLY_NO_AUTHORITY');
      assert.equal(preflight.structureMatches,true);
      for(const capability of ['publicIntakeAllowed','consentProvenanceVerified',
        'serverAntiBotVerified','authenticatedTenantVerified','durableCrmReceiptVerified',
        'canPersist','canSendToPortal','canSendToCrm','canAcknowledgeVisitor',
        'canReplaceLegacyBudgetForm','canDeploy'])
        assert.equal(preflight[capability],false,capability);
      assert.equal(assessPrivateBudgetPreview({...draftFromPrivateBrowser,
        email:'invalid'}).code,'INVALID_CONTACT_ROUTE');
      assert.equal(assessPrivateBudgetPreview({...draftFromPrivateBrowser,
        previewUnderstanding:false}).code,'PREVIEW_ACKNOWLEDGEMENT_REQUIRED');
      const serialized=JSON.stringify(preflight);
      for(const pii of [draftFromPrivateBrowser.name,draftFromPrivateBrowser.email,
        draftFromPrivateBrowser.details])
        assert.ok(!serialized.includes(pii),'F158: no contact value in diagnostic');
      assert.equal(await p.locator('form button').isDisabled(),true);
      assert.ok((await p.locator('#sending-disabled').textContent())?.includes('Envio indisponível'));
      assert.ok((await p.locator('h1').textContent())?.includes('prévia privada'));
      const violations=await new AxeBuilder({page:p})
        .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(violations.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],
        'F82 private form '+viewport.label+' WCAG');
      const horizontalOverflow=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(horizontalOverflow<=2,'F82 private form '+viewport.label+' horizontal overflow');
      assert.deepEqual(requests,[],'F82 private form must make no network requests');
    }finally{await ctx.close();}
  }
  console.log('Browser QA passed:',sitePages.length,'mobile routes, 9 desktop routes, verified internal/external links and anchors, axe WCAG 2.1 A/AA for 3 pages per viewport.');
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
