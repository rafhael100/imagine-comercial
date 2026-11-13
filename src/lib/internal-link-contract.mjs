/**
 * F143 — static link health for generated HTML, not a network crawler.
 * Internal destinations must be exact public routes from the curated catalog.
 * URL fragments are preserved for page JS behavior (e.g. /contato/#service).
 * Does not fetch, navigate, or collect visitor/session information.
 */
import assert from 'node:assert/strict';
import {anchorOpeningTags,requiredAnchorHref} from './html-anchor-reader.mjs';

const TAG=/<a\b[^>]*>/gi;
const HREF=/\bhref\s*=\s*(["'])(.*?)\1/i;
const ROOT_ROUTE=/^\/(?:[a-z0-9-]+\/)*$/;
const SAFE_FRAGMENT=/^[A-Za-z0-9_:-]+$/;
const EXTERNAL=/^(?:https:\/\/[^\/\s?#]+(?:[^\s]*)?|mailto:[^\s]+|tel:[+0-9-]+)$/i;

export function auditCuratedInternalLinks(html,availableRoutes){
  assert.equal(typeof html,'string','F143: compiled HTML required');
  assert.ok(Array.isArray(availableRoutes)&&availableRoutes.length>0,
    'F143: curated route list required');
  const approved=new Set();
  for(const path of availableRoutes){
    assert.match(path,ROOT_ROUTE,'F143: invalid route catalog item');
    assert.ok(!approved.has(path),'F143: duplicate route catalog item');
    approved.add(path);
  }
  let checked=0;
  for(const tag of anchorOpeningTags(html)){
    const href=requiredAnchorHref(tag);
    assert.ok(typeof href==='string','F143: link without href');
    assert.ok(href.length>0&&href.length<=2048&&
      !/[\s\\\x00-\x1f\x7f<>]/.test(href),
      'F143: unsafe link attribute');
    if(href.startsWith('#')){
      assert.match(href.slice(1),SAFE_FRAGMENT,'F143: invalid local fragment');
    }else if(href.startsWith('/')){
      assert.ok(!href.startsWith('//')&&!href.includes('?')&&
        !href.includes('%')&&href.indexOf('#')===href.lastIndexOf('#'),
        'F143: ambiguous internal URL');
      const [pathname,fragment]=href.split('#');
      assert.match(pathname,ROOT_ROUTE,'F143: noncanonical internal URL');
      assert.ok(approved.has(pathname),'F143: internal link points to missing public route');
      if(fragment!==undefined)assert.match(fragment,SAFE_FRAGMENT,
        'F143: invalid internal fragment');
    }else{
      assert.match(href,EXTERNAL,'F143: unsupported or relative link scheme');
    }
    checked++;
  }
  assert.ok(checked>0,'F143: expected public navigation');
  return Object.freeze({checkedLinks:checked,networkPerformed:false});
}
