import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sitePages} from '../src/data/services.mjs';
import {
 INTERNATIONAL_LANGUAGES,INTERNATIONAL_SECTIONS,internationalPagePaths,
 intlPath,languageAlternates,languageSwitchTargets,portuguesePathForSection,
 sectionForPortuguesePath,translations
} from '../src/data/i18n.mjs';

test('Portuguese existing public URLs remain unchanged and 26 international routes are explicit',()=>{
 assert.deepEqual(INTERNATIONAL_LANGUAGES,['en','es']);
 assert.equal(internationalPagePaths.length,INTERNATIONAL_SECTIONS.length*2);
 assert.equal(new Set(internationalPagePaths).size,internationalPagePaths.length);
 assert.ok(sitePages.some(x=>x.path==='/'));
 for(const path of internationalPagePaths){
   assert.ok(sitePages.some(p=>p.path===path),'Missing reviewed public international path '+path);
   assert.match(path,/^\/(?:en|es)\/(?:[a-z0-9-]+\/)*$/);
 }
 assert.throws(()=>intlPath('fr'),/Unreviewed/);
 assert.throws(()=>intlPath('en','../../portal'),/Unreviewed/);
});
test('language flags use exact translated counterpart; Portuguese article is not falsely translated',()=>{
 for(const section of INTERNATIONAL_SECTIONS){
   const portuguese=portuguesePathForSection(section);
   assert.ok(portuguese);
   assert.equal(sectionForPortuguesePath(portuguese),section);
   const expected={'pt-BR':portuguese,en:intlPath('en',section),es:intlPath('es',section),'x-default':portuguese};
   for(const candidate of [portuguese,intlPath('en',section),intlPath('es',section)]){
     assert.deepEqual(languageAlternates(candidate),expected);
     assert.deepEqual(languageSwitchTargets(candidate),{'pt-BR':portuguese,en:intlPath('en',section),es:intlPath('es',section)});
   }
 }
 assert.equal(languageAlternates('/conteudos/'),null);
 assert.equal(languageAlternates('/conteudos/landing-page-ou-site/'),null);
 assert.deepEqual(languageSwitchTargets('/conteudos/'),{'pt-BR':'/',en:'/en/',es:'/es/'});
 assert.equal(languageAlternates('/en/unsupported/'),null);
});
test('all six offers and primary pages contain authored English and Spanish, no fake checkout',()=>{
 for(const lang of INTERNATIONAL_LANGUAGES){
   const copy=translations[lang];
   assert.equal(Object.keys(copy.services).length,6);
   for(const [slug,s] of Object.entries(copy.services)){
     assert.ok(s.label.length>=7,slug);
     assert.ok(s.intro.length>=60,slug);
     assert.ok(s.approach.length>=35,slug);
     assert.equal(s.details.length,3,slug);
     assert.equal(s.question.length,2,slug);
   }
   assert.equal(copy.faq.length,4);
   assert.equal(copy.stages.length,4);
   assert.ok(copy.contact.noSend.length>30);
   assert.ok(copy.headings.note.length>60);
 }
 assert.match(translations.en.faq[1][1],/paid directly to Google or Meta/);
 assert.match(translations.es.faq[1][1],/directamente a Google o Meta/);
});
