import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services,sitePages} from '../src/data/services.mjs';
import {translations,languageAlternates,languageSwitchTargets,internationalPagePaths}
  from '../src/data/i18n.mjs';
import {CHANNELS,calculateMediaBudget}
  from '../src/lib/media-budget-calculator.mjs';
import {categoryForService} from '../src/data/service-catalog-groups.mjs';
import {curatedServiceComparisons} from '../src/data/service-comparison-pairs.mjs';
import {relatedEditorialGuides} from '../src/data/service-related-guides.mjs';
import {serviceFaqLinks} from '../src/data/service-faq-links.mjs';

const slug='gestao-chatgpt-ads';
const routes=[
  '/servicos/'+slug+'/',
  '/en/services/'+slug+'/',
  '/es/services/'+slug+'/'
];

test('ChatGPT Ads has exactly three reviewed localized service routes and no unapproved public route',()=>{
  assert.equal(services.length,7);
  const s=services.filter(x=>x.slug===slug);
  assert.equal(s.length,1);
  assert.equal(categoryForService(slug),'anuncios');
  assert.ok(s[0].heading.includes('ChatGPT'));
  assert.match(s[0].approach,/piloto mensurável/);
  for(const path of routes)assert.equal(sitePages.filter(x=>x.path===path).length,1);
  assert.equal(internationalPagePaths.includes(routes[1]),true);
  assert.equal(internationalPagePaths.includes(routes[2]),true);
  assert.equal(sitePages.length,63);
  assert.deepEqual(languageAlternates(routes[0]),{
    'pt-BR':routes[0],'en':routes[1],'es':routes[2],'x-default':routes[0]
  });
  for(const path of routes) {
    assert.deepEqual(languageSwitchTargets(path),{
      'pt-BR':routes[0],en:routes[1],es:routes[2]
    });
  }
});

test('ChatGPT Ads appears in all curated links and has original reviewed editorial content',()=>{
  for(const lang of ['en','es']) {
    const t=translations[lang].services[slug];
    assert.ok(t.label.includes('ChatGPT'));
    assert.ok(t.intro.length>=60 && t.approach.length>=35);
    assert.equal(t.details.length,3);
    assert.equal(t.question.length,2);
    assert.match(t.question[1],/sponsor|anuncio/i);
    assert.match(t.approach,/approv|aproba|homologa|eligible|elegi|account|cuenta|eligib/i);
  }
  const pairs=curatedServiceComparisons(slug);
  assert.equal(pairs.length,2);
  assert.ok(pairs.every(x=>x.href.startsWith('/comparar-solucoes/#comparar:')));
  assert.ok(pairs.every(x=>x.slug!==slug));
  assert.ok(relatedEditorialGuides(slug).length>0);
  assert.equal(serviceFaqLinks(slug).length,2);
  const template=readFileSync(new URL('../src/pages/servicos/[slug].astro',import.meta.url),'utf8');
  assert.match(template,/href="\/calculadora-de-anuncios\/"/);
  assert.doesNotMatch(template,/<form\b|fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});

test('ChatGPT advertising budget and prior Meta/Google terms remain isolated from checkout',()=>{
  assert.equal(CHANNELS.meta_ads.floorCents,70000);
  assert.equal(CHANNELS.google_ads.floorCents,100000);
  assert.equal(CHANNELS.chatgpt_ads.floorCents,120000);
  assert.equal(CHANNELS.chatgpt_ads.recommendedCents,180000);
  const calc=calculateMediaBudget({channels:['chatgpt_ads','meta_ads','google_ads']});
  assert.equal(calc.minimumMediaCents,290000);
  assert.equal(calc.suggestedMediaCents,430000);
  assert.equal(calc.illustrativeManagementCents,86000);
  assert.equal(calc.illustrativeTotalCents,516000);
  assert.equal(calc.publicCheckoutEnabled,false);
  assert.equal(calc.leadSentToCrm,false);
  assert.equal(calc.doesNotGuaranteeLeadsOrSales,true);
});
