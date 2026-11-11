import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {services} from '../src/data/services.mjs';
import {articleContactIntent} from '../src/lib/article-contact-intent.mjs';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';

test('F145: artigos conduzem ao contato apenas por slug de serviço curado',()=>{
  const slugs=new Set(services.map(item=>item.slug));
  for(const article of articles){
    const result=articleContactIntent(article);
    assert.ok(Object.isFrozen(result));
    assert.ok(result.href==='/contato/'||
      result.href==='/contato/#'+result.serviceSlug);
    if(result.serviceSlug) assert.ok(slugs.has(result.serviceSlug));
    const reviewed=reviewPublicLinks([{href:result.href}],{
      currentPath:'/conteudos/'+article.slug+'/'
    });
    assert.equal(reviewed.internal,1);
  }
});

test('F145: objetos externos nunca selecionam o CTA público',()=>{
  for(const bad of [
    null,{},Object.create(null),{links:[{href:'https://example.invalid/'}]},
    {slug:articles[0].slug,links:articles[0].links},
    {slug:'__proto__',links:[]}
  ])assert.throws(()=>articleContactIntent(bad),/outside reviewed catalog/);
});

test('F145: CTA editorial permanece acessível e preserva contato genérico',()=>{
  const source=readFileSync(new URL('../src/pages/conteudos/[slug].astro',import.meta.url),'utf8');
  assert.match(source,/articleContactIntent\(article\)/);
  assert.match(source,/href=\{contactIntent\.href\}/);
  assert.match(source,/href="\/contato\/"/);
  assert.doesNotMatch(source,/<form\b|fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
});
