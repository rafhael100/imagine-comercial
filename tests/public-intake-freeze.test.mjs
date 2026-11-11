import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertNoUnapprovedPublicIntake} from '../src/lib/public-intake-freeze.mjs';

test('F76: allow the current informational contact page and curated contact links',()=>{
  const html='<html><body><a href="https://wa.me/5585996632689">WhatsApp</a>'+
    '<a href="mailto:imagine@example.test?subject=Contato">Email</a>'+
    '<p>O formulário estará disponível após homologação.</p></body></html>';
  assert.equal(assertNoUnapprovedPublicIntake('contato/index.html',html),true);
  assert.equal(assertNoUnapprovedPublicIntake('_astro/contato.js',
    'document.querySelector("#contact-whatsapp").setAttribute("aria-label","WhatsApp");'),true);
});

test('F76: reject every unapproved public form and embedded third-party content',()=>{
  for(const source of [
    '<form method="post" action="/contact"><button>Enviar</button></form>',
    '<FORM><p>Orçamento</p></FORM>',
    '<input type="hidden" name="email">',
    '<textarea name="briefing"></textarea>',
    '<iframe src="https://example.test/lead"></iframe>',
    '<script defer src="https://example.test/tracker.js"></script>'
  ])assert.throws(()=>assertNoUnapprovedPublicIntake('contato/index.html',source),
    /F76: blocked/);
});

test('F76: block programmatic lead intake, cookies and network APIs in HTML or JS',()=>{
  for(const source of [
    'fetch("/api/contact",{method:"POST"})',
    'new XMLHttpRequest()',
    'navigator.sendBeacon("/collect",{})',
    'new WebSocket("wss://example.test")',
    'new EventSource("/events")',
    'document.cookie="lead=yes"',
    'localStorage.setItem("email","x")',
    'sessionStorage.setItem("name","x")',
    'const endpoint="/api/leads"',
    'const url="/api/orcamentos?source=site"',
    'const PUBLIC_LEAD_CAPTURE_URL="https://example.test"',
    'import {SyntheticLeadInbox} from "./lead-intake-lab.mjs"'
  ]){
    assert.throws(()=>assertNoUnapprovedPublicIntake('_astro/app.js',source),
      /F76: blocked/,source);
    assert.throws(()=>assertNoUnapprovedPublicIntake('contato/index.html',source),
      /F76: blocked/,source);
  }
});

test('F76: refuse invalid assets or missing scan inputs',()=>{
  for(const [path,source] of [
    ['', 'hello'],['public.txt','hello'],['contact.html',null],
    [null,'html'],['bundle.jsx','const x=1']
  ])assert.throws(()=>assertNoUnapprovedPublicIntake(path,source),
    /F76: invalid built asset/);
});

test('F76: guard runs after each Astro build validation, without enablement flags',()=>{
  const script=readFileSync(new URL('../scripts/verify-dist.mjs',import.meta.url),'utf8');
  const policy=readFileSync(new URL('../src/lib/public-intake-freeze.mjs',import.meta.url),'utf8');
  assert.match(script,/function walkBuiltFiles\(folder\)/);
  assert.match(script,/walkBuiltFiles\('dist'\)/);
  assert.match(script,/assertNoUnapprovedPublicIntake\(relative\('dist',file\),readFileSync\(file,'utf8'\)\)/);
  assert.doesNotMatch(policy,/process\.env|ALLOW_LEADS|BYPASS|developmentMode/);
  const workflow=readFileSync(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');
  assert.ok((workflow.match(/node scripts\/verify-dist\.mjs/g)||[]).length>=2);
});
