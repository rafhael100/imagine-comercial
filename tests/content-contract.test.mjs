import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { services, sitePages, toAbsoluteUrl } from '../src/data/services.mjs';
import { resolvePortalLoginLink } from '../src/lib/portal-login-link.mjs';
import {contactChannels} from '../src/data/contact-channels.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('all service identifiers and public routes are distinct and well formed', () => {
  assert.equal(new Set(services.map(x => x.slug)).size, services.length);
  assert.equal(new Set(sitePages.map(x => x.path)).size, sitePages.length);
  assert.ok(services.length >= 5);
  for (const service of services) {
    assert.match(service.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(sitePages.some(page => page.path === '/servicos/' + service.slug + '/'));
    assert.equal(toAbsoluteUrl('/servicos/' + service.slug + '/'), 'https://imaginecomunicacao.com.br/servicos/' + service.slug + '/');
  }
});

test('each commercial service has distinct and substantive editorial content', () => {
  for (const key of ['title','heading','description','intro']) {
    assert.equal(new Set(services.map(x => x[key])).size, services.length, 'duplicate ' + key);
  }
  for (const s of services) {
    assert.ok(s.title.length >= 20 && s.title.length <= 90);
    assert.ok(s.description.length >= 65 && s.description.length <= 180);
    assert.ok(s.intro.length >= 80);
    assert.ok(s.details.length >= 3);
    assert.ok(s.faqs.length >= 2);
    for (const [question, answer] of s.faqs) {
      assert.ok(question.length >= 20);
      assert.ok(answer.length >= 70);
    }
  }
});

test('all approved sitemap paths are canonical and do not expose private routes', () => {
  for (const page of sitePages) {
    assert.match(page.path, /^\/(?:[a-z0-9-]+\/)*$/);
    assert.doesNotMatch(page.path, /(?:admin|checkout|portal|login|cliente|preview|staging)/);
    assert.match(toAbsoluteUrl(page.path), /^https:\/\/imaginecomunicacao\.com\.br\//);
  }
  assert.throws(() => toAbsoluteUrl('https://other.example/'), /Invalid public/);
});

test('site title, description, canonical, robots and schema render in layout', () => {
  const source = read('src/layouts/BaseLayout.astro');
  for (const expected of ['lang="pt-BR"', 'rel="canonical"', 'name="description"', 'name="robots"', 'application/ld+json', 'og:title', 'skip-link']) {
    assert.ok(source.includes(expected), 'missing ' + expected);
  }
});

test('all service pages are generated from one curated service catalog', () => {
  const source = read('src/pages/servicos/[slug].astro');
  assert.ok(source.includes('getStaticPaths'));
  assert.ok(source.includes('services.map'));
  assert.ok(source.includes('serviceName={s.label}'));
  assert.ok(source.includes("href={'/contato/#' + s.slug}"));
});

test('contact uses traceable public channels and no unapproved live capture', () => {
  const source = read('src/pages/contato.astro');
  assert.ok(source.includes('contactChannels.email'));
  assert.ok(source.includes('contactChannels.phoneE164'));
  assert.equal(contactChannels.email,'imagine@imaginecomunicacao.com.br');
  assert.equal(contactChannels.phoneE164,'+558530329525');
  assert.doesNotMatch(source, /<form|method="post"|fetch\(/);
});

test('sitemap uses the curated page list with no hardcoded thousands of local pages', () => {
  const source = read('src/pages/sitemap.xml.ts');
  assert.ok(source.includes('sitePages'));
  assert.ok(source.includes('toAbsoluteUrl'));
  assert.doesNotMatch(source, /for\s*\(.*(?:municipio|cidade)/i);
});

test('about page is part of the curated sitemap and public navigation', () => {
  assert.ok(sitePages.some(p => p.path === '/sobre/'));
  assert.ok(read('src/layouts/BaseLayout.astro').includes('href="/sobre/"'));
});

test('JSON-LD safely escapes HTML delimiters and Portal login is HTTPS-restricted', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  assert.ok(layout.includes('serializeJsonLd'));
  assert.ok(layout.includes("replace(/</g,"));
  assert.ok(layout.includes('resolvePortalLoginLink(import.meta.env.PUBLIC_PORTAL_LOGIN_URL)'));
  assert.equal(resolvePortalLoginLink('http://portal.imaginecomunicacao.com.br/login'),'');
  assert.equal(resolvePortalLoginLink('https://evil.imaginecomunicacao.com.br/login'),'');
  assert.equal(resolvePortalLoginLink('https://portal.imaginecomunicacao.com.br/login'),
    'https://portal.imaginecomunicacao.com.br/login');
});
