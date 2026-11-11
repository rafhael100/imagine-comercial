/**
 * F149 — fail closed on external navigation in built public HTML.
 * Only published, explicitly curated channels and configured Portal login
 * are permitted. Never fetches destinations or logs user-specific URLs.
 */
import assert from 'node:assert/strict';
import {
  contactChannels,contactWhatsAppUrl,contactEmailUrl
} from '../data/contact-channels.mjs';
import {resolvePortalLoginLink} from './portal-login-link.mjs';

const attr=(tag,key)=>new RegExp('\\b'+key+'\\s*=\\s*(["\\x27])(.*?)\\1','i')
  .exec(tag)?.[2]??null;
const blank=tag=>attr(tag,'target')==='_blank';
const relSafe=tag=>{
  const rel=(attr(tag,'rel')??'').toLowerCase().split(/\s+/);
  return rel.includes('noopener')&&rel.includes('noreferrer');
};

function verifyExternalHref(href){
  if(typeof href!=='string'||href.length>1024||
    /[\x00-\x20\x7f<>"'\\]/.test(href))
    return false;
  if(href.startsWith('https://')){
    let parsed;
    try{parsed=new URL(href);}catch{return false;}
    if(parsed.username||parsed.password||parsed.port||parsed.hash)return false;
    if(parsed.hostname==='wa.me'){
      if(parsed.pathname!=='/'+contactChannels.whatsappE164)return false;
      const params=[...parsed.searchParams.entries()];
      if(params.length===0)return href===contactChannels.whatsappBaseHref;
      if(params.length!==1||params[0][0]!=='text')return false;
      try{return href===contactWhatsAppUrl(params[0][1]);}
      catch{return false;}
    }
    return href===resolvePortalLoginLink(href);
  }
  if(href.startsWith('mailto:')){
    const plain='mailto:'+contactChannels.email;
    if(href===plain)return true;
    if(!href.startsWith(plain+'?subject='))return false;
    let subject;
    try{subject=decodeURIComponent(href.slice((plain+'?subject=').length));}
    catch{return false;}
    try{return href===contactEmailUrl(subject);}catch{return false;}
  }
  if(href.startsWith('tel:'))return href==='tel:'+contactChannels.phoneE164;
  return false;
}

export function auditApprovedOutboundLinks(html){
  assert.equal(typeof html,'string','F149: compiled HTML required');
  let checked=0;
  for(const tag of html.match(/<a\b[^>]*>/gi)??[]){
    const href=attr(tag,'href');
    if(href===null||href.startsWith('/')||href.startsWith('#'))continue;
    assert.ok(verifyExternalHref(href),
      'F149: external destination is not an approved public channel');
    if(blank(tag))assert.ok(relSafe(tag),
      'F149: new-tab external link lacks isolation attributes');
    checked++;
  }
  return Object.freeze({externalLinksChecked:checked,networkPerformed:false});
}
