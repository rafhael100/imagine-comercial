import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { assertNoUnapprovedPublicIntake } from '../src/lib/public-intake-freeze.mjs';
import { services } from '../src/data/services.mjs';

const read = path => readFileSync(join('dist', path), 'utf8');
import { sitePages, toAbsoluteUrl } from '../src/data/services.mjs';
import { verifyIndexablePage, verifySitemapUrls, verifyRobotsSitemap } from '../src/lib/seo-output-contract.mjs';
import {verifyJsonLdPage} from '../src/lib/jsonld-output-contract.mjs';
const paths = sitePages.map(p=>p.path==='/' ? 'index.html' : p.path.slice(1)+'index.html');

for (const [index, path] of paths.entries()) {
  assert.ok(existsSync(join('dist', path)), 'Build missing HTML: ' + path);
  const html = read(path);
  assert.match(html, /<html lang="pt-BR"/, path);
  assert.match(html, /<h1[ >]/, path);
  assert.match(html, /rel="canonical"/, path);
  assert.match(html, /name="description"/, path);
  assert.match(html, /application\/ld\+json/, path);
  assert.doesNotMatch(html, /asaas\.com|focusnfe\.com/, path);
  verifyIndexablePage(html, toAbsoluteUrl(sitePages[index].path));
  verifyJsonLdPage(html, toAbsoluteUrl(sitePages[index].path));
}
for (const path of ['sitemap.xml', 'robots.txt']) {
  assert.ok(existsSync(join('dist', path)), 'Build missing SEO file: ' + path);
}
const notFoundPath = '404.html';
assert.ok(existsSync(join('dist', notFoundPath)), 'Build missing custom 404 document');
const notFound = read(notFoundPath);
assert.match(notFound, /name="robots" content="noindex,nofollow"/);
assert.doesNotMatch(notFound, /rel="canonical"/, '404 must not claim a canonical indexable URL');
assert.doesNotMatch(notFound, /application\/ld\+json/, '404 must not claim public indexable structured data');
assert.match(notFound, /href="\/servicos\/"/);
assert.match(notFound, /href="\/contato\/"/);
const sitemap = read('sitemap.xml');
verifySitemapUrls(sitemap, sitePages.map(p => toAbsoluteUrl(p.path)));
verifyRobotsSitemap(read('robots.txt'), 'https://imaginecomunicacao.com.br/sitemap.xml');
for (const service of services) {
  assert.ok(sitemap.includes('/servicos/' + service.slug + '/'), 'Missing sitemap route: ' + service.slug);
}
assert.doesNotMatch(sitemap, /\/checkout\/|\/admin\/|\/portal\/|\/404\//);
function walkBuiltFiles(folder){
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
    const path=join(folder,entry.name);
    return entry.isDirectory()?walkBuiltFiles(path):entry.isFile()?[path]:[];
  });
}
let frozenAssets=0;
for(const file of walkBuiltFiles('dist')){
  if(!/\.(?:html|js)$/i.test(file))continue;
  assertNoUnapprovedPublicIntake(relative('dist',file),readFileSync(file,'utf8'));
  frozenAssets++;
}
assert.ok(frozenAssets>=paths.length+1,'F76: expected all built pages and JS to be inspected');
console.log('F76 public intake freeze checked',frozenAssets,'built HTML and JS files');
console.log('Built SEO routes validated:', paths.length, 'HTML pages and sitemap/robots');
