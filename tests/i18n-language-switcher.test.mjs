import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sitePages} from '../src/data/services.mjs';
import {INTERNATIONAL_ARTICLE_SLUGS,internationalArticles} from '../src/data/i18n-articles.mjs';
import {
 INTERNATIONAL_LANGUAGES,INTERNATIONAL_SECTIONS,internationalPagePaths,
 intlPath,languageAlternates,languageSwitchTargets,portuguesePathForSection,
 sectionForPortuguesePath,translations
} from '../src/data/i18n.mjs';

test('Portuguese URLs remain unchanged and all commercial plus editorial international routes are explicit',()=>{
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
test('language flags use exact counterparts for all published pages',()=>{
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
 assert.deepEqual(languageSwitchTargets('/conteudos/'),{'pt-BR':'/conteudos/',en:'/en/articles/',es:'/es/articles/'});
 for(const slug of INTERNATIONAL_ARTICLE_SLUGS){
   const pt='/conteudos/'+slug+'/';
   const links=languageAlternates(pt);
   assert.equal(links?.en,'/en/articles/'+slug+'/');
   assert.equal(links?.es,'/es/articles/'+slug+'/');
 }
 assert.equal(languageAlternates('/conteudos/unsupported/'),null);
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

test('five professional guides have complete, uniquely authored EN/ES editorial bodies',()=>{
  assert.equal(INTERNATIONAL_ARTICLE_SLUGS.length,5);
  for(const lang of INTERNATIONAL_LANGUAGES){
    const articles=internationalArticles[lang];
    assert.deepEqual(Object.keys(articles),INTERNATIONAL_ARTICLE_SLUGS);
    const titles=new Set(),descriptions=new Set();
    for(const slug of INTERNATIONAL_ARTICLE_SLUGS){
      const a=articles[slug];
      assert.ok(a.title.length>=22&&a.title.length<=95,slug);
      assert.ok(a.description.length>=60&&a.description.length<=195,slug);
      assert.ok(a.intro.length>=100,slug);
      assert.ok(a.sections.length>=5,slug);
      for(const section of a.sections){
        assert.equal(section.length,3,slug);
        assert.ok(section[0].length>=20,slug);
        assert.ok(section[1].length>=90,slug);
        assert.ok(section[2].length>=85,slug);
      }
      titles.add(a.title);descriptions.add(a.description);
      assert.ok(sitePages.some(x=>x.path==='/'+lang+'/articles/'+slug+'/'));
    }
    assert.equal(titles.size,5);
    assert.equal(descriptions.size,5);
  }
  assert.match(internationalArticles.en['criacao-de-sites-fortaleza-guia'].sections[0][1],/Fortaleza/);
  assert.match(internationalArticles.es['criacao-de-sites-fortaleza-guia'].sections[0][1],/Fortaleza/);
});
