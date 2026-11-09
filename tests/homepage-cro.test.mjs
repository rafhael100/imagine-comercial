import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {services} from '../src/data/services.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('homepage leads with real contact CTA, offers service navigation and visual illustration',()=>{
  const s=read('src/pages/index.astro');
  assert.ok(s.indexOf('href="/contato/"')<s.indexOf('href="/servicos/"'));
  assert.ok(s.includes('<HeroVisual />'));
  assert.ok(s.includes('additional.map'));
  assert.equal(services.length,6);
});

test('decorative illustration makes no unverifiable social proof or ranking claims',()=>{
  const s=read('src/components/HeroVisual.astro');
  assert.ok(s.includes('aria-hidden="true"'));
  assert.doesNotMatch(s,/\d+\s*(?:clientes|vendas|conversões|premiações)/i);
  assert.doesNotMatch(s,/(?:posição\s*1|primeiro lugar|garantia de resultados)/i);
});
