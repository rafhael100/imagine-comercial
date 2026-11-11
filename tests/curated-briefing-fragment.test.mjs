import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {contactObjectives} from '../src/data/contact-objectives.mjs';
import {briefingStages,briefingPriorities} from '../src/data/briefing-curado.mjs';
import {encodeCuratedBriefingFragment as encode,
  decodeCuratedBriefingFragment as decode}
  from '../src/data/curated-briefing-fragment.mjs';

test('F169 560 public briefing combinations round-trip without free text or PII',()=>{
  let count=0,seen=new Set();
  for(const service of ['',...services.map(x=>x.slug)])
  for(const objective of ['',...contactObjectives.map(x=>x.code)])
  for(const stage of ['',...briefingStages.map(x=>x.code)])
  for(const priority of ['',...briefingPriorities.map(x=>x.code)]){
    const fragment=encode(service,objective,stage,priority);
    assert.match(fragment,/^#briefing:[a-z0-9~-]+:[a-z0-9~-]+:[a-z0-9~-]+:[a-z0-9~-]+$/);
    assert.equal(fragment.includes('?'),false);
    assert.equal(fragment.includes('%'),false);
    assert.ok(fragment.length<145);
    assert.deepEqual(decode(fragment),{service,objective,stage,priority});
    assert.ok(Object.isFrozen(decode(fragment)));
    seen.add(fragment);count++;
  }
  assert.equal(count,560);
  assert.equal(seen.size,560);
  assert.equal(encode(),'#briefing:~:~:~:~');
});
test('F169 unsupported user text, alternate encoding and malformed hashes fail closed',()=>{
  for(const value of ['#onepage','#briefing:onepage',
    '#briefing:onepage:novo-projeto:iniciando',
    '#briefing:onepage:novo-projeto:iniciando:oferta:extra',
    '#briefing:onepage:CPF-123:iniciando:oferta',
    '#briefing:onepage:novo-projeto:iniciando:%6fferta',
    '#briefing:onepage:novo-projeto:iniciando:oferta?source=email',
    '#briefing:onepage:novo-projeto:iniciando:oferta#x',
    '#briefing:onepage:novo-projeto:iniciando:oferta\nsecret',
    '#briefing:onepage:novo-projeto:iniciando:oferta'.repeat(30),
    '',null,42,{},[]
  ])assert.equal(decode(value),null,'reject '+String(value).slice(0,50));
  for(const values of [
    ['../../etc/passwd','','',''],
    ['onepage','pessoal@exemplo.invalid','',''],
    ['onepage','','client-id',''],
    ['onepage','','','urgente;CPF=1'],
    [null,'','',''],[{},'','',''],['onepage',123,'','']
  ])assert.throws(()=>encode(...values),/unsupported reviewed/);
});
test('F169 page shares only origin + fixed contact route + curated hash with explicit click',()=>{
  const page=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.match(page,/id="copy-briefing-link" hidden/);
  assert.match(page,/share\.addEventListener\('click', async \(\) =>/);
  assert.match(page,/window\.location\.origin\+'\/contato\/'\+fragment/);
  assert.match(page,/encodeCuratedBriefingFragment\(/);
  assert.match(page,/decodeCuratedBriefingFragment\('#'\+requested\)/);
  assert.match(page,/choice\.value = allowed\.has\(requested\) \? requested : ''/);
  assert.match(page,/id="copy-briefing-status"[^>]*role="status" aria-live="polite"/);
  assert.doesNotMatch(page,/<form\b|<input\b|<textarea\b|fetch\s*\(|sendBeacon\s*\(|localStorage|sessionStorage|document\.cookie/);
});
