import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sitePages} from '../src/data/services.mjs';
import {contactChannels} from '../src/data/contact-channels.mjs';

const src=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const section=src.slice(src.indexOf('<footer>'),src.indexOf('</footer>')+'</footer>'.length);

test('F246 footer uses the exact original Imagine logo with accessible brand link',()=>{
  assert.match(section,/<a class="footer-brand" href="\/" aria-label="Imagine Comunicação Digital — Página inicial">/);
  assert.match(section,/<img src="\/logo-imagine\.png" alt="" width="170" loading="lazy"/);
  assert.match(src,/\.footer-grid \{ display: grid;/);
  assert.match(src,/@media \(max-width: 620px\) \{ \.footer-grid \{ grid-template-columns: minmax\(0,1fr\)/);
});
test('F246 footer groups only current reviewed page links',()=>{
  for(const label of ['Serviços no rodapé','Institucional no rodapé'])
    assert.ok(section.includes('aria-label="'+label+'"'));
  const routes=[...section.matchAll(/<a href="(\/[^"]+)"/g)].map(x=>x[1]);
  assert.ok(routes.length>=7,'useful service and company navigation');
  for(const path of routes)
    assert.ok(sitePages.some(x=>x.path===path),'unknown footer route '+path);
});
test('F246 contact channels match reviewed catalog and warn about verification',()=>{
  assert.match(section,/contactChannels\.email/);
  assert.match(section,/contactChannels\.whatsappBaseHref/);
  assert.match(section,/rel="noopener noreferrer"/);
  assert.match(section,/precisam ser reconfirmados antes da publicação/);
  assert.ok(contactChannels.email.endsWith('@imaginecomunicacao.com.br'));
  assert.doesNotMatch(section,/<form\b|<input\b|fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});
