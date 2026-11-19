import test from 'node:test';
import assert from 'node:assert/strict';
import {auditApprovedOutboundLinks} from '../src/lib/outbound-link-contract.mjs';
import {contactWhatsAppUrl} from '../src/data/contact-channels.mjs';

const href=contactWhatsAppUrl();
const link=(extra='')=>'<a href="'+href+'" '+extra+'>Abrir WhatsApp</a>';

test('F272 outbound audit accepts a real isolated external link',()=>{
  assert.equal(auditApprovedOutboundLinks(link('target="_blank" rel="noopener noreferrer"')).externalLinksChecked,1);
});

test('F272 data-rel and aria-rel cannot fake new-tab isolation',()=>{
  for(const fake of [
    'data-rel="noopener noreferrer"',
    'aria-rel="noopener noreferrer"',
    'rel="noopener" data-rel="noreferrer"',
    'rel="noreferrer" aria-rel="noopener"',
    'data-rel="noopener noreferrer" rel=""'
  ])assert.throws(()=>auditApprovedOutboundLinks(link('target="_blank" '+fake)),
    /lacks isolation/,fake);
  assert.throws(()=>auditApprovedOutboundLinks(link(
    'target="_blank" rel="noopener noreferrer" REL="noopener noreferrer"'
  )),/duplicate SEO attribute/);
});

test('F272 fake data-target does not impose an imaginary new-tab policy',()=>{
  assert.equal(auditApprovedOutboundLinks(link('data-target="_blank"')).externalLinksChecked,1);
  assert.throws(()=>auditApprovedOutboundLinks(link(
    'target="_blank" data-rel="noopener noreferrer"'
  )),/lacks isolation/);
});

test('F272 fake data-href or unquoted href cannot bypass outbound validation',()=>{
  assert.throws(()=>auditApprovedOutboundLinks(
    '<a data-href="'+href+'">Canal falso</a>'
  ),/F268:/);
  assert.throws(()=>auditApprovedOutboundLinks(
    '<a href='+href+'>Link inválido</a>'
  ),/F268:/);
});
