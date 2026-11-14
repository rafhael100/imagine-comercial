/**
 * F144 — verify meaningful and unique HTML title/description metadata for
 * all indexable, built site pages, not only their canonical/sitemap alignment.
 */
import assert from 'node:assert/strict';
import {readStrictHtmlAttribute} from './html-attribute-reader.mjs';

const headOf=html=>/<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1]??null;
const tags=(html,name)=>[...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','gi'))].map(x=>x[0]);
const attribute=(tag,key)=>readStrictHtmlAttribute(tag,key);

const normalize=x=>x.replaceAll('&amp;','&').replaceAll('&nbsp;',' ')
  .replace(/\s+/g,' ').trim().normalize('NFKC').toLocaleLowerCase('pt-BR');

export function auditIndexableMetadata(pages){
  assert.ok(Array.isArray(pages)&&pages.length>=2,
    'F144: complete compiled page inventory required');
  const seenRoutes=new Set(),titles=new Set(),descriptions=new Set();
  for(const entry of pages){
    assert.ok(entry&&typeof entry==='object'&&
      typeof entry.path==='string'&&typeof entry.html==='string',
      'F144: valid built page required');
    assert.ok(!seenRoutes.has(entry.path),'F144: duplicated page route');
    seenRoutes.add(entry.path);
    const head=headOf(entry.html);
    assert.ok(head!==null,'F144: missing head');
    const titleMatches=[...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
    assert.equal(titleMatches.length,1,'F144: expected one document title');
    const title=normalize(titleMatches[0][1]);
    assert.ok(title.length>=20&&title.length<=110,'F144: title length outside bounds');
    assert.ok(!titles.has(title),'F144: repeated document title');
    titles.add(title);
    const meta=tags(head,'meta').filter(x=>attribute(x,'name')==='description');
    assert.equal(meta.length,1,'F144: expected one meta description');
    const description=normalize(attribute(meta[0],'content')??'');
    assert.ok(description.length>=60&&description.length<=220,
      'F144: description length outside bounds');
    assert.ok(!descriptions.has(description),'F144: repeated meta description');
    descriptions.add(description);
    assert.ok(!/[<>]/.test(description),'F144: unsafe meta description');
  }
  return Object.freeze({checkedPages:pages.length,
    uniqueTitles:titles.size,uniqueDescriptions:descriptions.size,
    networkPerformed:false});
}
