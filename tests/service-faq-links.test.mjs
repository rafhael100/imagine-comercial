import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {commercialFaqSections} from '../src/data/commercial-faq.mjs';
import {serviceFaqLinks} from '../src/data/service-faq-links.mjs';

test('F190 each of six services links to exactly two public FAQ answers',()=>{
  const questions=new Map(commercialFaqSections.flatMap(section=>
    section.questions.map(item=>[item.id,item.question])
  ));
  for(const service of services){
    const links=serviceFaqLinks(service.slug);
    assert.equal(links.length,2);
    assert.ok(Object.isFrozen(links));
    assert.equal(new Set(links.map(item=>item.href)).size,2);
    for(const link of links){
      const id=link.href.replace('/perguntas-frequentes/#duvida-','');
      assert.equal(link.href,'/perguntas-frequentes/#duvida-'+id);
      assert.equal(link.label,questions.get(id));
      assert.ok(Object.isFrozen(link));
    }
  }
});
test('F190 rejects unapproved slugs and refuses invented FAQ links',()=>{
  for(const candidate of ['',null,42,{},'constructor','unknown','../', 'onepage?email=x']){
    assert.throws(()=>serviceFaqLinks(candidate),/unknown service slug/);
  }
});
test('F190 service pages use only static curated FAQ destinations',()=>{
  const page=readFileSync(new URL('../src/pages/servicos/[slug].astro',import.meta.url),'utf8');
  assert.match(page,/serviceFaqLinks\(s\.slug\)/);
  assert.match(page,/class="service-faq-related"/);
  assert.match(page,/href={item\.href}/);
  assert.doesNotMatch(page,/fetch\(|localStorage|sessionStorage|document\.cookie|<form/);
});
