import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedPrivateQuoteHandoffUrl,checkReviewedPrivateQuoteHandoffUrl,REVIEWED_PRIVATE_QUOTE_BASE,isPrivateQuotePreviewBuild}
 from '../ops/review/purchase/private-quote-handoff-f325.mjs';
import {buildCommercialChoicePreview} from '../src/lib/commercial-choice-preview.mjs';

test('F325: anonymous exact quote choice reaches the single isolated Portal shop route',()=>{
 const choices={site:'onepage',channels:['meta_ads','google_ads'],tier:'recommended'};
 const expected='https://portal-dev.imaginecomunica.com.br/_preview/portal/shop?site=onepage&channels=google_ads%2Cmeta_ads&tier=recommended';
 const url=reviewedPrivateQuoteHandoffUrl(choices);
 assert.equal(url,expected);
 assert.equal(new URL(url).origin,'https://portal-dev.imaginecomunica.com.br');
 assert.equal(new URL(url).pathname,'/_preview/portal/shop');
 assert.deepEqual([...new URL(url).searchParams.keys()],['site','channels','tier']);
 assert.equal(checkReviewedPrivateQuoteHandoffUrl(url,choices),true);
 assert.equal(checkReviewedPrivateQuoteHandoffUrl(url+'&amount_cents=1',choices),false);
 assert.equal(checkReviewedPrivateQuoteHandoffUrl(url.replace('https://','http://'),choices),false);
 assert.equal(checkReviewedPrivateQuoteHandoffUrl(url.replace('tier=recommended','tier=minimum'),choices),false);
 assert.equal(checkReviewedPrivateQuoteHandoffUrl(url+'#x',choices),false);
 assert.equal(REVIEWED_PRIVATE_QUOTE_BASE,'https://portal-dev.imaginecomunica.com.br/_preview/portal/shop');
});

test('F325: all public editorial combinations have an exact no-price Portal preview link',()=>{
 let checked=0;
 for(const site of ['none','onepage','landing-pages'])
  for(const channels of [[],['google_ads'],['meta_ads'],['google_ads','meta_ads']])
   for(const tier of ['minimum','recommended']){
    const chosen={site,channels,tier};
    if(!buildCommercialChoicePreview(chosen).hasChoice){
      assert.throws(()=>reviewedPrivateQuoteHandoffUrl(chosen));
      continue;
    }
    const url=reviewedPrivateQuoteHandoffUrl(chosen);
    assert.equal(checkReviewedPrivateQuoteHandoffUrl(url,chosen),true);
    const parsed=new URL(url);
    assert.equal(parsed.searchParams.get('site'),site);
    assert.equal(parsed.searchParams.get('channels'),channels.join(','));
    assert.equal(parsed.searchParams.get('tier'),tier);
    assert.ok(![...parsed.searchParams.keys()].some(key=>/amount|price|customer|token|secret|currency/i.test(key)));
    checked++;
   }
 assert.equal(checked,22);
});

test('F325: malformed, duplicated, ineligible and checkout-forging choices rejected',()=>{
 for(const v of [
  null,{},[],{site:'none',channels:[],tier:'minimum'},
  {site:'__proto__',channels:[],tier:'recommended'},
  {site:'onepage',channels:['google_ads','google_ads'],tier:'minimum'},
  {site:'onepage',channels:['chatgpt_ads'],tier:'recommended'},
  {site:'onepage',channels:['meta_ads'],tier:'fake'},
  {site:'onepage',channels:'meta_ads',tier:'minimum'}
 ])assert.throws(()=>reviewedPrivateQuoteHandoffUrl(v));
});

test('F325: staging handoff is opt-in for private CI builds only',()=>{
 assert.equal(isPrivateQuotePreviewBuild({GITHUB_ACTIONS:'true',IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW:'1'}),true);
 for(const bad of [
  {},{GITHUB_ACTIONS:'false',IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW:'1'},
  {GITHUB_ACTIONS:'true',IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW:'0'},
  {GITHUB_ACTIONS:'true',IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW:'1',IMAGINE_RELEASE_TARGET:'production'}
 ])assert.equal(isPrivateQuotePreviewBuild(bad),false);
 const astro=readFileSync(new URL('../src/components/CommercialChoicePreview.astro',import.meta.url),'utf8');
 assert.match(astro,/data-private-handoff-base=\{privatePortalBuild\?REVIEWED_PRIVATE_QUOTE_BASE:undefined\}/);
 assert.match(astro,/data-choice-fallback=\{contact\}/);
 assert.match(astro,/reviewedQuoteChoiceHref\(locale,\{site,channels,tier\}\)/);
 assert.match(astro,/target=\{privatePortalBuild\?undefined:"_blank"\}/);
 assert.doesNotMatch(astro,/<form\b|<input\b|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|\bfetch\s*\(/);
});
