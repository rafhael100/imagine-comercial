import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pages=[
 'src/pages/como-funciona.astro','src/pages/comparar-solucoes.astro',
 'src/pages/conteudos/[slug].astro','src/pages/conteudos/index.astro',
 'src/pages/perguntas-frequentes.astro','src/pages/servicos/[slug].astro',
 'src/pages/servicos/index.astro'
];
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('F241 all inner page components inherit warm Imagine palette without blue CTAs',()=>{
  for(const path of pages){
    const source=read(path);
    const css=source.slice(source.indexOf('<style>'));
    assert.ok(css.startsWith('<style>'),path+' must contain local styles');
    for(const obsolete of ['#0b5ea9','#145d9d','#176ebd','#173f70','#dce6f2'])
      assert.equal(css.includes(obsolete),false,path+' must not use former blue accent '+obsolete);
    assert.ok(/#(?:884100|793800|b45b00|171b19|e8e2da)/i.test(css),
      path+' needs visible warm or neutral design token');
  }
});
test('F241 active filters, selection states and keyboard focus stay visible',()=>{
  const guide=read('src/pages/conteudos/index.astro');
  const compare=read('src/pages/comparar-solucoes.astro');
  const services=read('src/pages/servicos/index.astro');
  const process=read('src/pages/como-funciona.astro');
  assert.match(guide,/\.guide-filter-button\[aria-pressed="true"\]\{background:#171b19;color:#fff/);
  assert.match(compare,/\.compare-selector:focus-visible\{outline:3px solid #b45b00/);
  assert.match(services,/#service-guide-compare:focus-visible\{outline:3px solid #b45b00/);
  assert.match(process,/\.briefing-toggle:focus-visible\{outline:3px solid #b45b00/);
});
