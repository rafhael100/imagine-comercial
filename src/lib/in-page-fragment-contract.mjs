/**
 * F147 — verify in-page fragment links point to real IDs in static HTML.
 * Cross-page URL fragments (e.g. /contato/#service) are deliberately
 * excluded because that page's reviewed client-side logic handles them.
 */
import assert from 'node:assert/strict';

const attr=(tag,name)=>new RegExp('\\b'+name+'\\s*=\\s*(["\\x27])(.*?)\\1','i')
  .exec(tag)?.[2]??null;

export function auditInPageFragments(html){
  assert.equal(typeof html,'string','F147: compiled HTML required');
  const ids=new Set();
  for(const match of html.matchAll(/<[a-z][a-z0-9:-]*\b[^>]*>/gi)){
    const id=attr(match[0],'id');
    if(id===null)continue;
    assert.ok(id.length>0&&!ids.has(id),
      'F147: duplicate or empty anchor ID');
    ids.add(id);
  }
  let checked=0;
  for(const match of html.matchAll(/<a\b[^>]*>/gi)){
    const href=attr(match[0],'href');
    if(!href?.startsWith('#'))continue;
    const fragment=href.slice(1);
    assert.ok(fragment.length>0&&ids.has(fragment),
      'F147: local fragment target not present in page');
    checked++;
  }
  return Object.freeze({
    uniqueIds:ids.size,
    samePageLinksChecked:checked,
    networkPerformed:false
  });
}
