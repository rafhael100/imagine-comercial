import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
test('F72 contact warns before transferring visitor to an external channel',()=>{
  assert.match(source,/id="external-channel-notice" class="contact-channel-notice"/);
  assert.match(source,/Ao abrir o WhatsApp, o texto preparado aparece no serviço/);
  assert.match(source,/confira e confirme o envio/);
  assert.match(source,/e-mail abre o aplicativo configurado no seu dispositivo/);
  assert.match(source,/não recebe uma solicitação por meio deste site apenas porque você selecionou/);
});
test('F72 WhatsApp and email CTAs expose disclosure to assistive technologies',()=>{
  assert.match(source,/id="contact-whatsapp"[^>]+target="_blank" rel="noopener noreferrer" aria-describedby="external-channel-notice"/);
  assert.match(source,/id="contact-email"[^>]+aria-describedby="external-channel-notice"/);
  assert.match(source,/id="contact-whatsapp" href=\{contactWhatsAppUrl\(\)\}/);
  assert.match(source,/id="contact-email" href=\{contactEmailUrl\(\)\}/);
  assert.doesNotMatch(source,/<form\b|fetch\(|navigator\.sendBeacon|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|innerHTML/);
});
