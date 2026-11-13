import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAccessibleLinkNames} from '../src/lib/accessible-link-contract.mjs';

const audit=markup=>auditAccessibleLinkNames('<main>'+markup+'</main>');

test('F273 genuine text, aria label and image alt still name links',()=>{
  for(const markup of [
    '<a href="/contato/">Entrar em contato</a>',
    '<a href="/contato/" aria-label="Solicitar atendimento"></a>',
    '<a href="/"><img alt="Logo Imagine" src="/logo-imagine.png"></a>'
  ])assert.equal(audit(markup).namedLinksChecked,1);
});

test('F273 data-aria-label and aria-data-label cannot fake a real link name',()=>{
  for(const fake of ['data-aria-label','aria-data-label']){
    assert.throws(()=>audit('<a href="/contato/" '+fake+'="Entrar em contato"></a>'),
      /missing a meaningful accessible name/);
  }
});

test('F273 data-alt and aria-alt cannot fake accessible image links',()=>{
  for(const fake of ['data-alt','aria-alt']){
    assert.throws(()=>audit(
      '<a href="/"><img src="/logo-imagine.png" '+fake+'="Logomarca Imagine"></a>'
    ),/missing a meaningful accessible name/);
  }
});

test('F273 duplicate aria-label or alt are invalid markup',()=>{
  assert.throws(()=>audit(
    '<a href="/" aria-label="Contato" aria-label="Outro contato"></a>'
  ),/duplicate SEO attribute/);
  assert.throws(()=>audit(
    '<a href="/"><img alt="Logo" alt="Outra logomarca" src="/logo-imagine.png"></a>'
  ),/duplicate SEO attribute/);
});
