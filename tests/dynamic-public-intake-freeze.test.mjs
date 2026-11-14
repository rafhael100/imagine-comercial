import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertNoUnapprovedPublicIntake as scan} from '../src/lib/public-intake-freeze.mjs';

test('F160: compiled public JS cannot create forms or submit dynamic lead payloads',()=>{
 for(const payload of [
   "document.createElement('form')", 'document.createElement("input")',
   "document.createElement('textarea')", 'new FormData(element)',
   'const body = FormData', 'form.requestSubmit()', 'el.submit()',
   "wrapper.innerHTML='<form action=\"/submit\">'",
   'el.outerHTML="<input name=email>"',
   "node.insertAdjacentHTML('beforeend',html)"
 ]){
   assert.throws(()=>scan('_astro/compiled.js',payload),/F76: blocked/,payload);
   assert.throws(()=>scan('contato/index.html',payload),/F76: blocked/,payload);
 }
});

test('F160: public assets cannot retain leads in IndexedDB or detached workers',()=>{
 for(const payload of [
   'indexedDB.open("leads")', 'new SharedWorker("intake.js")',
   'new BroadcastChannel("client-leads")',
   'navigator.serviceWorker.register("/sw.js")'
 ]) assert.throws(()=>scan('_astro/public.js',payload),/F76: blocked/,payload);
});

test('F160: no-JS public catalog and visitor-triggered clipboard remain supported',()=>{
 const html='<a href="/contato/#onepage">Solicitar proposta</a>'+
   '<select id="service-choice"><option value="onepage">Onepage</option></select>';
 const script="const link=document.createElement('a');"+
   "const list=document.createElement('li');"+
   "navigator.clipboard.writeText('Olá, gostaria de conhecer os serviços da Imagine.');";
 assert.equal(scan('contato/index.html',html),true);
 assert.equal(scan('_astro/contact.js',script),true);
});

test('F160: release build still calls freeze on each compiled JS and HTML asset',()=>{
 const source=readFileSync(new URL('../scripts/verify-dist.mjs',import.meta.url),'utf8');
 assert.match(source,/assertNoUnapprovedPublicIntake\(relative\('dist',file\),readFileSync\(file,'utf8'\)\)/);
 const policy=readFileSync(new URL('../src/lib/public-intake-freeze.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(policy,/process\.env|BYPASS|ALLOW_PUBLIC_INTAKE/);
});
