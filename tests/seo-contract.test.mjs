import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('layout has canonical, description, robots and structured data', () => {
  const html = read('src/layouts/BaseLayout.astro');
  for (const required of ['rel="canonical"', 'name="description"', 'name="robots"', 'application/ld+json', 'lang="pt-BR"']) {
    assert.ok(html.includes(required), required);
  }
});

test('service landing page has specific title, H1 and internal link', () => {
  const page = read('src/pages/servicos/landing-pages.astro');
  assert.match(page, /Criação de Landing Pages \| Imagine/);
  assert.match(page, /<h1>/);
  assert.match(page, /href="\/#processo"/);
});

test('sitemap only includes authored public pages', () => {
  const sitemap = read('src/pages/sitemap.xml.ts');
  assert.match(sitemap, /servicos\/landing-pages/);
  assert.doesNotMatch(sitemap, /checkout|\/admin|\/clientes/);
});

test('no production payment or portal address is hardcoded', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  assert.ok(layout.includes('PUBLIC_PORTAL_LOGIN_URL'));
  assert.doesNotMatch(layout, /asaas\.com|focusnfe\.com|portal\.imaginecomunicacao\.com\.br/);
});
