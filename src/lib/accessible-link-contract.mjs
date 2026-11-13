/**
 * F151 — static accessible name baseline for every anchor in built HTML.
 * A link must expose descriptive visible text, aria-label or image alt.
 * This complements browser axe tests over the full static page inventory.
 * No user traffic, network, accessibility claims about dynamic states.
 */
import assert from 'node:assert/strict';
import {readStrictHtmlAttribute} from './html-attribute-reader.mjs';
const attr=(tag,name)=>readStrictHtmlAttribute(tag,name);

const normalize=text=>String(text).replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
const descriptive=text=>{
  const value=normalize(text);
  return value.length<=240 && (value.match(/[\p{L}\p{N}]/gu)??[]).length>=2;
};

export function auditAccessibleLinkNames(html){
  assert.equal(typeof html,'string','F151: compiled HTML required');
  const matches=[...html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a\s*>/gi)];
  const opening=(html.match(/<a\b[^>]*>/gi)??[]).length;
  assert.equal(matches.length,opening,'F151: malformed or unclosed anchor markup');
  let checked=0;
  for(const [,start,children] of matches){
    const aria=attr(start,'aria-label');
    const text=normalize(children.replace(/<script\b[\s\S]*?<\/script>/gi,'')
      .replace(/<style\b[\s\S]*?<\/style>/gi,'')
      .replace(/<[^>]*>/g,''));
    const img=children.match(/<img\b[^>]*>/i)?.[0];
    const alt=img?attr(img,'alt'):null;
    assert.ok([aria,text,alt].some(value=>
      typeof value==='string'&&descriptive(value)),
      'F151: link missing a meaningful accessible name');
    checked++;
  }
  return Object.freeze({namedLinksChecked:checked,networkPerformed:false});
}
