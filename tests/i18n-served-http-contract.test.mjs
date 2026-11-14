import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyServedLanguageParity as verify} from '../src/lib/i18n-served-http-contract.mjs';
import {languageAlternates,languageSwitchTargets} from '../src/data/i18n.mjs';
import {sitePages,toAbsoluteUrl} from '../src/data/services.mjs';

const options=Object.freeze([
 ['pt-BR','Português'],['en','English'],['es','Español']
]);
const render=path=>{
 const current=path.startsWith('/en/')?'en':path.startsWith('/es/')?'es':'pt-BR';
 const alt=languageAlternates(path),dest=languageSwitchTargets(path);
 return '<!doctype html><html lang="'+current+'"><head>'+
  '<link rel="canonical" href="'+toAbsoluteUrl(path)+'">'+
  Object.entries(alt).map(([code,to])=>
   '<link rel="alternate" hreflang="'+code+'" href="'+toAbsoluteUrl(to)+'">').join('')+
  '</head><body><nav class="locale-switcher" aria-label="Language choice">'+
  options.map(([code,label])=>'<a class="locale-option" href="'+dest[code]+
    '" lang="'+code+'" hreflang="'+code+'" aria-label="'+label+'"'+
    (code===current?' aria-current="page"':'')+'><span>🇧🇷</span></a>').join('')+
  '</nav></body></html>';
};
test('all curated public pages are eligible for exact edge language parity',()=>{
 // 57 original pages plus PT/EN/ES translated calculator = 60 audited routes.
 assert.equal(sitePages.length,60);
 const seen=new Set();
 for(const {path} of sitePages){
   assert.ok(!seen.has(path),path);
   seen.add(path);
   const summary=verify(render(path),path);
   assert.equal(summary.path,path);
   assert.equal(summary.alternatesVerified,4);
   assert.equal(summary.flagLinksVerified,3);
   assert.equal(summary.selectedLanguageVerified,true);
   assert.ok(Object.isFrozen(summary));
 }
});
test('an HTTP page cannot claim the wrong language, route, canonical or alternate',()=>{
 const p='/en/articles/landing-page-ou-site/',html=render(p);
 assert.throws(()=>verify(html,'/en/unsupported/'),/F-I18N-EDGE/);
 assert.throws(()=>verify(html,'/es/articles/landing-page-ou-site/'),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('lang="en"','lang="fr"'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('rel="canonical"','rel="alternate"'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('hreflang="x-default"','hreflang="fr"'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace(toAbsoluteUrl('/es/articles/landing-page-ou-site/'),
    toAbsoluteUrl('/es/')),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('hreflang="es"','hreflang="en"'),p),/F-I18N-EDGE/);
});
test('flag navigation cannot silently point to another locale or lose current state',()=>{
 const p='/es/services/gestao-meta-ads/',html=render(p);
 assert.throws(()=>verify(html.replace('href="/en/services/gestao-meta-ads/"','href="/en/"'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('aria-current="page"','aria-current="true"'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('class="locale-switcher"','class="hidden"'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('lang="pt-BR" hreflang="pt-BR"','lang="es" hreflang="pt-BR"'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('aria-label="English"','aria-label=""'),p),/F-I18N-EDGE/);
 assert.throws(()=>verify(html.replace('hreflang="es" href=','hreflang="es" hreflang="es" href='),p),/F-I18N-EDGE/);
});
test('unknown legacy English paths remain unpublishable by the new route contract',()=>{
 for(const path of ['/en-us/','/en-us/termos-de-uso.html','/en-us/customers.html']){
   assert.throws(()=>verify(render('/en/'),path),/F-I18N-EDGE/);
 }
});
