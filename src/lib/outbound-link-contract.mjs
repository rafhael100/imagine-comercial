/**
 * F149/F155 — fail closed on external navigation in built public HTML.
 * F155 narrows even WhatsApp text/mail subjects to the exact reviewed
 * service and objective combinations; a benign prefix is not sufficient.
 * No network requests, user data, URL logging or dynamic allowlist.
 */
import assert from 'node:assert/strict';
import {readStrictHtmlAttribute} from './html-attribute-reader.mjs';
import {anchorOpeningTags,requiredAnchorHref} from './html-anchor-reader.mjs';
import {
  contactChannels,contactWhatsAppUrl,contactEmailUrl
} from '../data/contact-channels.mjs';
import {services} from '../data/services.mjs';
import {
  contactObjectives,composeCuratedContactLinks
} from '../data/contact-objectives.mjs';
import {briefingStages,briefingPriorities,composeCuratedBriefingLinks} from '../data/briefing-curado.mjs';
import {resolvePortalLoginLink} from './portal-login-link.mjs';

const attr=(tag,key)=>readStrictHtmlAttribute(tag,key);

const blank=tag=>attr(tag,'target')==='_blank';
const relSafe=tag=>{
  const rel=(attr(tag,'rel')??'').toLowerCase().split(/\s+/);
  return rel.includes('noopener')&&rel.includes('noreferrer');
};

const whatsappLinks=new Set([contactChannels.whatsappBaseHref]);
const mailLinks=new Set(['mailto:'+contactChannels.email]);
for(const service of ['',...services.map(x=>x.slug)]){
  for(const objective of ['',...contactObjectives.map(x=>x.code)]){
    const intent=composeCuratedContactLinks(service,objective);
    whatsappLinks.add(contactWhatsAppUrl(intent.message));
    mailLinks.add(contactEmailUrl(intent.subject));
    // F142: optional stage and priority add only reviewed catalog labels.
    // Dynamic mailto uses a body only if stage or priority was selected.
    for(const stage of ['',...briefingStages.map(x=>x.code)]){
      for(const priority of ['',...briefingPriorities.map(x=>x.code)]){
        const expanded=composeCuratedBriefingLinks(service,objective,stage,priority);
        whatsappLinks.add(contactWhatsAppUrl(expanded.message));
        if(stage||priority)mailLinks.add(contactEmailUrl(expanded.subject,expanded.message));
      }
    }
  }
}

export function isApprovedPublicExternalHref(href){
  if(typeof href!=='string'||href.length>1024||
    /[\x00-\x20\x7f<>"'\\]/.test(href))
    return false;
  if(href.startsWith('https://')){
    // Exact output of reviewed catalog builders only. Alternate encodings,
    // additional tracking parameters and forged pretext are denied.
    if(whatsappLinks.has(href))return true;
    return href===resolvePortalLoginLink(href);
  }
  if(href.startsWith('mailto:'))return mailLinks.has(href);
  if(href.startsWith('tel:'))return href==='tel:'+contactChannels.phoneE164;
  return false;
}

export function auditApprovedOutboundLinks(html){
  assert.equal(typeof html,'string','F149: compiled HTML required');
  let checked=0;
  for(const tag of anchorOpeningTags(html)){
    const href=requiredAnchorHref(tag);
    if(href===null||href.startsWith('/')||href.startsWith('#'))continue;
    assert.ok(isApprovedPublicExternalHref(href),
      'F149: external destination is not an approved public channel');
    if(blank(tag))assert.ok(relSafe(tag),
      'F149: new-tab external link lacks isolation attributes');
    checked++;
  }
  return Object.freeze({externalLinksChecked:checked,networkPerformed:false});
}
