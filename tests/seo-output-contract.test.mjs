import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyIndexablePage, verifySitemapUrls, verifyRobotsSitemap
} from '../src/lib/seo-output-contract.mjs';

const home = 'https://imaginecomunicacao.com.br/';
const contact = 'https://imaginecomunicacao.com.br/contato/';
const html = canonical => `<!doctype html><html lang="pt-BR"><head>
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow">
<meta property="og:url" content="${canonical}">
</head><body><h1>Imagine</h1></body></html>`;

test('F21 valida canonical e OG em igualdade exata', () => {
  assert.equal(verifyIndexablePage(html(home), home), true);
  assert.throws(() => verifyIndexablePage(html(home), contact), /canonical URL mismatch/);
  assert.throws(() => verifyIndexablePage(html(home).replace(
    '<meta property="og:url" content="' + home + '">',
    '<meta property="og:url" content="' + contact + '">'), home), /og:url differs/);
});

test('F21 bloqueia canonical duplicado, ausente e noindex acidental', () => {
  assert.throws(() => verifyIndexablePage(html(home) +
    '<link rel="canonical" href="' + home + '">', home), /exactly one canonical/);
  assert.throws(() => verifyIndexablePage(
    html(home).replace('rel="canonical"', 'rel="alternate"'), home), /exactly one canonical/);
  assert.throws(() => verifyIndexablePage(
    html(home).replace('index,follow', 'noindex,nofollow'), home), /cannot be noindex/);
});

test('F21 compara sitemap com catálogo exato e identifica URLs faltantes ou duplicadas', () => {
  const xml = urls => `<urlset>${urls.map(u=>'<url><loc>'+u+'</loc></url>').join('')}</urlset>`;
  assert.equal(verifySitemapUrls(xml([home, contact]), [home, contact]), true);
  assert.throws(() => verifySitemapUrls(xml([home]), [home, contact]), /sitemap routes differ/);
  assert.throws(() => verifySitemapUrls(xml([home, home]), [home, contact]), /duplicate sitemap loc/);
  assert.throws(() => verifySitemapUrls(xml([home, 'https://example.org/']), [home, contact]),
    /sitemap routes differ/);
});

test('F21 valida declaração única do sitemap em robots.txt', () => {
  const expected = home + 'sitemap.xml';
  assert.equal(verifyRobotsSitemap('User-agent: *\nAllow: /\nSitemap: ' +
    expected + '\n', expected), true);
  assert.throws(() => verifyRobotsSitemap('User-agent: *\nAllow: /\n', expected),
    /exactly one sitemap/);
  assert.throws(() => verifyRobotsSitemap('Sitemap: https://outro.example/sitemap.xml\n', expected),
    /Expected values to be strictly equal/);
});
