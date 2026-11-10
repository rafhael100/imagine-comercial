import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';

const fixture=readFileSync(new URL('./fixtures/private-contact-form-preview.html',import.meta.url),'utf8');
const browserQa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F82: preview is private by location, has no send path and cannot be indexed',()=>{
  assert.match(fixture,/<html lang="pt-BR">/);
  assert.match(fixture,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(fixture,/<dialog open aria-labelledby="form-title">/);
  assert.match(fixture,/<form id="private-budget-preview" method="dialog" autocomplete="off">/);
  assert.match(fixture,/<button type="submit" disabled aria-describedby="sending-disabled">/);
  assert.doesNotMatch(fixture,/<script\b|\baction=|https?:\/\/|\bfetch\s*\(|<iframe\b/);
  assert.match(fixture,/Não existe envio, registro de pedido ou integração com Portal\/CRM/);
  assert.match(fixture,/aviso de privacidade e a base legal do formulário real ainda precisam de aprovação/);
});

test('F82: exact six service options preserve the curated public service slugs',()=>{
  const offered=[...fixture.matchAll(/<option value="([a-z0-9-]+)">/g)].map(x=>x[1]);
  assert.deepEqual([...offered].sort(),services.map(s=>s.slug).sort());
  assert.ok(!offered.includes('fake-service'));
});

test('F82: accessibility and human input controls have explicit labels/help',()=>{
  for(const id of ['lead-name','lead-email','lead-phone','lead-service',
                    'lead-details','preview-understanding']){
    assert.match(fixture,new RegExp('id="'+id+'"'));
    assert.match(fixture,new RegExp('for="'+id+'"'));
  }
  for(const control of ['lead-name','lead-service','lead-details','preview-understanding']){
    assert.match(fixture,new RegExp('id="'+control+'"[^>]*required'));
  }
  assert.match(fixture,/id="sending-disabled" role="status"/);
  assert.match(fixture,/label for="lead-email">E-mail \(regra final a definir\)/);
  assert.match(fixture,/label for="lead-phone">Telefone \(regra final a definir\)/);
});

test('F82: browser QA tests the private fixture but never builds a public route for it',()=>{
  assert.match(browserQa,/private-contact-form-preview\.html/);
  assert.match(browserQa,/setContent\(privateFormSource/);
  assert.match(browserQa,/new AxeBuilder\(\{page:p\}\)/);
  assert.match(browserQa,/form button\[type="submit"\]:disabled/);
  assert.match(browserQa,/private form must make no network requests/);
  const page=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.doesNotMatch(page,/<form\b|<input\b|private-contact-form-preview/i);
});
