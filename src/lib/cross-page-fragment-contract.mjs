/**
 * F148 — verify cross-page anchor targets in the compiled public site.
 * Exception: /contato/#<service> is implemented by the reviewed contact
 * selector rather than a static DOM id. Only catalog service slugs are
 * accepted for that explicitly defined route.
 *
 * No requests, redirects, visitor data, browser APIs or DOM mutation.
 */
import assert from 'node:assert/strict';
import {services} from '../data/services.mjs';

const ROUTE=/^\/(?:[a-z0-9-]+\/)*$/;
const FRAGMENT=/^[A-Za-z0-9_:-]+$/;
const attr=(tag,name)=>new RegExp('\\b'+name+'\\s*=\\s*(["\\x27])(.*?)\\1','i')
  .exec(tag)?.[2]??null;
const serviceSlugs=new Set(services.map(s=>s.slug));

export function auditCrossPageFragmentTargets(pages){
  assert.ok(Array.isArray(pages)&&pages.length>=2,
    'F148: complete compiled page list required');
  const destinations=new Map();
  for(const entry of pages){
    assert.ok(entry&&typeof entry.path==='string'&&
      typeof entry.html==='string','F148: compiled page required');
    assert.match(entry.path,ROUTE,'F148: invalid page route');
    assert.ok(!destinations.has(entry.path),'F148: duplicated page route');
    const ids=new Set();
    for(const tag of entry.html.match(/<[a-z][a-z0-9:-]*\b[^>]*>/gi)??[]){
      const id=attr(tag,'id');
      if(id!==null)ids.add(id);
    }
    destinations.set(entry.path,ids);
  }
  let checked=0,semanticTargets=0;
  for(const entry of pages){
    for(const tag of entry.html.match(/<a\b[^>]*>/gi)??[]){
      const href=attr(tag,'href');
      if(typeof href!=='string'||!href.startsWith('/')||
        href.startsWith('//')||!href.includes('#'))continue;
      const parts=href.split('#');
      assert.equal(parts.length,2,'F148: ambiguous URL fragment');
      const [path,fragment]=parts;
      assert.match(path,ROUTE,'F148: invalid destination path');
      assert.match(fragment,FRAGMENT,'F148: invalid destination fragment');
      assert.ok(destinations.has(path),'F148: cross-page route missing');
      if(path===entry.path){
        // F147 independently validates same-page links.
        continue;
      }
      const exists=destinations.get(path).has(fragment);
      const isCuratedContactIntent=path==='/contato/' &&
        serviceSlugs.has(fragment);
      assert.ok(exists||isCuratedContactIntent,
        'F148: cross-page fragment is neither a real ID nor approved service intent');
      checked++;
      if(exists)semanticTargets++;
    }
  }
  return Object.freeze({
    crossPageFragmentsChecked:checked,
    staticTargetsChecked:semanticTargets,
    approvedContactIntents:checked-semanticTargets,
    networkPerformed:false
  });
}
