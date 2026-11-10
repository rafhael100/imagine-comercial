import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {contactWhatsAppUrl,contactChannels} from '../src/data/contact-channels.mjs';

const source=readFileSync(new URL('../src/pages/servicos/[slug].astro',import.meta.url),'utf8');
test('F73 uses service slugs only to render a direct WhatsApp fallback on each page',()=>{
  assert.match(source,/const directWhatsAppHref=contactWhatsAppUrl\(composeCuratedContactLinks\(s.slug\).message\)/);
  assert.match(source,/data-service-whatsapp href=\{directWhatsAppHref\}/);
  assert.match(source,/target="_blank" rel="noopener noreferrer" aria-describedby="service-whatsapp-notice"/);
  assert.match(source,/id="service-whatsapp-notice"/);
  assert.match(source,/Este site não registra sua solicitação/);
  for(const service of services){
    const link=contactWhatsAppUrl(composeCuratedContactLinks(service.slug).message);
    const url=new URL(link);
    assert.equal(url.hostname,'wa.me');
    assert.equal(url.pathname,'/'+contactChannels.whatsappE164);
    assert.ok(url.searchParams.get('text')?.includes(service.label));
    assert.ok(url.searchParams.get('text')?.startsWith('Olá,'));
    assert.ok(!url.searchParams.has('phone'));
  }
});
test('F73 preserves service-specific internal contact CTA and no-JS behavior',()=>{
  assert.equal((source.match(/href=\{'\/contato\/#' \+ s.slug\}/g)||[]).length,2);
  assert.doesNotMatch(source,/<form\b|<input\b|<script\b|localStorage|fetch\(|sendBeacon\(|document\.cookie/);
});
