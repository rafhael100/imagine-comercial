import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { services, sitePages, toAbsoluteUrl } from '../src/data/services.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('layout exposes canonical, meta description, robots and structured data', () => {
  const html = read('src/layouts/BaseLayout.astro');
  for (const expected of ['rel="canonical"', 'name="description"', 'name="robots"', 'application/ld+json', 'lang="pt-BR"']) {
    assert.ok(html.includes(expected), expected);
  }
});

test('landing page content has a title, H1 and action through the curated template', () => {
  const page = services.find(service => service.slug === 'landing-pages');
  assert.ok(page, 'landing page catalog entry missing');
  assert.match(page.title, /Landing Pages/);
  assert.ok(page.heading.length > 20);
  const template = read('src/pages/servicos/[slug].astro');
  assert.ok(template.includes('<h1>{s.heading}</h1>'));
  assert.ok(template.includes('href="/contato/"'));
});

test('sitemap uses authoritative published routes and excludes private paths', () => {
  const sitemap = read('src/pages/sitemap.xml.ts');
  assert.match(sitemap, /sitePages/);
  assert.ok(sitePages.some(p => p.path === '/servicos/landing-pages/'));
  for (const { path } of sitePages) {
    assert.match(toAbsoluteUrl(path), /^https:\/\/imaginecomunicacao\.com\.br\//);
    assert.doesNotMatch(path, /\/admin\/|\/checkout\/|\/portal\//);
  }
});

test('portal URL remains optional until integration is homologated', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  assert.ok(layout.includes('PUBLIC_PORTAL_LOGIN_URL'));
  assert.doesNotMatch(layout, /asaas\.com|focusnfe\.com|portal\.imaginecomunicacao\.com\.br/);
});
