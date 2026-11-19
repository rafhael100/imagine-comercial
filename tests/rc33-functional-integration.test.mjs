import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('RC33: article outline and related guides retain the contextual CTA F145',()=>{
 const page=read('src/pages/conteudos/[slug].astro');
 for(const token of ['articleContactIntent(article)','createEditorialOutline(article)',
   'relatedGuidesFor(article.slug)','contactIntent.href','contactIntent.label',
   'class="article-toc"','class="related-reading"','href="/contato/"'])
   assert.ok(page.includes(token),'Missing article feature '+token);
});
test('RC33: browser QA retains existing conversion and all new editorial cases',()=>{
 const qa=read('scripts/browser-qa.mjs');
 for(const marker of ['F145','F150','F151','F152','F153','F154',
   "F152 all guides remain usable without JavaScript",
   "F154 related guides remain visible without JavaScript"])
   assert.ok(qa.includes(marker),'Missing browser scenario '+marker);
});
test('RC33: public pages filter locally without capturing personal data',()=>{
 const index=read('src/pages/conteudos/index.astro');
 assert.match(index,/data-guide-filter/);
 assert.match(index,/id="guide-list"/);
 assert.doesNotMatch(index,/<form\b|<input\b|fetch\(/);
 const article=read('src/pages/conteudos/[slug].astro');
 assert.doesNotMatch(article,/<form\b|<input\b|fetch\(/);
});
