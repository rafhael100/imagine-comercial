import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { services } from '../src/data/services.mjs';

const read = path => readFileSync(join('dist', path), 'utf8');
const paths = ['index.html', 'contato/index.html', 'servicos/index.html',
  'conteudos/landing-page-ou-site/index.html',
  ...services.map(s => 'servicos/' + s.slug + '/index.html')];

for (const path of paths) {
  assert.ok(existsSync(join('dist', path)), 'Build missing HTML: ' + path);
  const html = read(path);
  assert.match(html, /<html lang="pt-BR"/, path);
  assert.match(html, /<h1[ >]/, path);
  assert.match(html, /rel="canonical"/, path);
  assert.match(html, /name="description"/, path);
  assert.match(html, /application\/ld\+json/, path);
  assert.doesNotMatch(html, /asaas\.com|focusnfe\.com/, path);
}
for (const path of ['sitemap.xml', 'robots.txt']) {
  assert.ok(existsSync(join('dist', path)), 'Build missing SEO file: ' + path);
}
const sitemap = read('sitemap.xml');
for (const service of services) {
  assert.ok(sitemap.includes('/servicos/' + service.slug + '/'), 'Missing sitemap route: ' + service.slug);
}
assert.doesNotMatch(sitemap, /\/checkout\/|\/admin\/|\/portal\//);
console.log('Built SEO routes validated:', paths.length, 'HTML pages and sitemap/robots');
