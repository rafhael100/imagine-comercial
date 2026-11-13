import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const layout=read('src/layouts/BaseLayout.astro');
const pages=[
 'src/pages/servicos/[slug].astro',
 'src/pages/conteudos/[slug].astro',
 'src/pages/como-funciona.astro',
 'src/pages/perguntas-frequentes.astro',
 'src/pages/comparar-solucoes.astro'
];
test('F245 one semantic breadcrumb nav originates in BaseLayout and mirrors JSON-LD',()=>{
  assert.match(layout,/nav class="shell breadcrumbs" aria-label="Caminho de navegação"/);
  assert.match(layout,/<ol>/);
  assert.match(layout,/<li><a href="\/">Início<\/a><\/li>/);
  assert.match(layout,/index===breadcrumb.length-1/);
  assert.match(layout,/<span aria-current="page">\{item.label\}<\/span>/);
  assert.match(layout,/breadcrumb.map\(\(item,index\)=>\(/);
  assert.match(layout,/'@type': 'BreadcrumbList'/);
  assert.match(layout,/<slot \/>/);
});
test('F245 older duplicate crumbs removed without losing catalog breadcrumb props',()=>{
  for(const path of pages){
    const source=read(path);
    assert.equal(source.includes('<div class="shell breadcrumbs">'),false,
      path+' must not duplicate the shared crumb');
    assert.match(source,/breadcrumb=\{/,
      path+' must provide reviewed breadcrumb data');
  }
});
test('F245 all public navigation remains safe, with no script or privacy dependency',()=>{
  // F291 makes main programmatically focusable for the keyboard skip link.
  const mainStart=layout.search(/<main id="conteudo"(?:\s[^>]*)?>/);
  assert.ok(mainStart>=0,'main landmark must exist');
  const source=layout.slice(mainStart);
  const nav=source.slice(0,source.indexOf('<slot />'));
  assert.doesNotMatch(nav,/\bfetch\s*\(|window\.location|localStorage|sessionStorage|<form\b|<input\b/);
  assert.match(nav,/breadcrumb.length>0/);
  assert.match(nav,/index===breadcrumb.length-1/);
});
