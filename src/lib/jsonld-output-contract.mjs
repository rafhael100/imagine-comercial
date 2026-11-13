/**
 * F140 — confirm that the generated JSON-LD for each public Astro page
 * identifies the exact same canonical URL as HTML, without inventing
 * authorship, prices, local addresses or publication dates.
 */
import assert from 'node:assert/strict';
import {readStrictHtmlAttribute} from './html-attribute-reader.mjs';

const ORG='https://imaginecomunicacao.com.br/#organization';
const ROOT='https://imaginecomunicacao.com.br/';

export function verifyJsonLdPage(html,canonical){
  assert.equal(typeof html,'string');
  assert.match(canonical,/^https:\/\/imaginecomunicacao\.com\.br\//);
  const entries=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    // F274: data-type and aria-type are NOT script type to Google.
    .filter(match=>readStrictHtmlAttribute('<script'+match[1]+'>','type')==='application/ld+json')
    .map(match=>JSON.parse(match[2]));
  const find=type=>entries.filter(item=>item&&typeof item==='object'&&
    !Array.isArray(item)&&item['@type']===type);
  const organization=find('Organization');
  assert.equal(organization.length,1,canonical+': expected one Organization');
  assert.equal(organization[0]['@id'],ORG,'Organization ID mismatch');
  assert.equal(organization[0].url,ROOT,'Organization URL mismatch');

  const webPage=find('WebPage');
  assert.equal(webPage.length,1,canonical+': expected one WebPage');
  assert.equal(webPage[0].url,canonical,'WebPage URL mismatch');
  assert.equal(webPage[0]['@id'],canonical+'#webpage','WebPage ID mismatch');
  assert.equal(webPage[0].inLanguage,'pt-BR','WebPage language mismatch');

  const isArticle=/^https:\/\/imaginecomunicacao\.com\.br\/conteudos\/[a-z0-9-]+\/$/.test(canonical);
  const isService=/^https:\/\/imaginecomunicacao\.com\.br\/servicos\/[a-z0-9-]+\/$/.test(canonical);
  const articles=find('Article');
  const services=find('Service');
  assert.equal(articles.length,isArticle?1:0,'unexpected Article markup');
  assert.equal(services.length,isService?1:0,'unexpected Service markup');
  if(isArticle){
    assert.equal(articles[0]['@id'],canonical+'#article','Article ID mismatch');
    assert.equal(articles[0].url,canonical,'Article URL mismatch');
    assert.equal(articles[0].mainEntityOfPage,canonical,'Article mainEntity mismatch');
    assert.ok(typeof articles[0].headline==='string'&&articles[0].headline.length>15);
  }
  if(isService){
    assert.equal(services[0]['@id'],canonical+'#service','Service ID mismatch');
    assert.equal(services[0].url,canonical,'Service URL mismatch');
    assert.equal(services[0].mainEntityOfPage,canonical,'Service mainEntity mismatch');
    assert.equal(services[0].provider?.['@id'],ORG,'Service publisher mismatch');
    assert.ok(typeof services[0].name==='string'&&services[0].name.length>5);
  }

  const bread=find('BreadcrumbList');
  assert.ok(bread.length<=1,'duplicate BreadcrumbList');
  if(bread.length===1){
    const list=bread[0].itemListElement;
    assert.ok(Array.isArray(list)&&list.length>=2,'invalid BreadcrumbList');
    list.forEach((item,i)=>{
      assert.equal(item['@type'],'ListItem');
      assert.equal(item.position,i+1);
      assert.match(item.item,/^https:\/\/imaginecomunicacao\.com\.br\//);
    });
    assert.equal(list.at(-1).item,canonical,'Breadcrumb destination mismatch');
  }
  assert.equal(entries.length,
    organization.length+webPage.length+articles.length+services.length+bread.length,
    'unknown JSON-LD entity emitted in public HTML');
  return true;
}
