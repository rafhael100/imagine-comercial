/**
 * F21 — verificações de igualdade exata entre HTML indexável e sitemap.
 * Somente leitura do build estático. Não acessa Google ou ambientes produtivos.
 */
import assert from 'node:assert/strict';

const tags = (html, tag) => html.match(new RegExp('<' + tag + '\\b[^>]*>', 'gi')) ?? [];
const attr = (tag, name) => {
  const result = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(["\\x27])(.*?)\\1', 'i'));
  return result?.[2] ?? null;
};

export function verifyIndexablePage(html, expectedCanonical) {
  assert.equal(typeof html, 'string');
  assert.match(expectedCanonical, /^https:\/\/imaginecomunicacao\.com\.br\//);
  const canonicalTags = tags(html, 'link').filter(tag => attr(tag, 'rel') === 'canonical');
  assert.equal(canonicalTags.length, 1, expectedCanonical + ': expected exactly one canonical');
  assert.equal(attr(canonicalTags[0], 'href'), expectedCanonical, 'canonical URL mismatch');

  const robots = tags(html, 'meta').filter(tag => attr(tag, 'name') === 'robots');
  assert.equal(robots.length, 1, expectedCanonical + ': expected one robots meta');
  assert.equal(attr(robots[0], 'content'), 'index,follow', 'indexable page cannot be noindex');

  const ogUrl = tags(html, 'meta').filter(tag => attr(tag, 'property') === 'og:url');
  assert.equal(ogUrl.length, 1, expectedCanonical + ': expected one og:url');
  assert.equal(attr(ogUrl[0], 'content'), expectedCanonical, 'og:url differs from canonical');

  const isArticle=/^https:\/\/imaginecomunicacao\.com\.br\/conteudos\/[a-z0-9-]+\/$/.test(expectedCanonical);
  const ogType=tags(html,'meta').filter(tag=>attr(tag,'property')==='og:type');
  assert.equal(ogType.length,1,'expected one og:type');
  assert.equal(attr(ogType[0],'content'),isArticle?'article':'website',
    'og:type does not match page kind');

  const twitterCard=tags(html,'meta').filter(tag=>attr(tag,'name')==='twitter:card');
  assert.equal(twitterCard.length,1,'expected one Twitter card type');
  assert.equal(attr(twitterCard[0],'content'),'summary','unsupported Twitter card type');
  const twitterUrl=tags(html,'meta').filter(tag=>attr(tag,'name')==='twitter:url');
  assert.equal(twitterUrl.length,1,'expected exactly one twitter:url');
  assert.equal(attr(twitterUrl[0],'content'),expectedCanonical,
    'twitter:url differs from canonical');
  for(const field of ['title','description']){
    const og=tags(html,'meta').filter(tag=>attr(tag,'property')==='og:'+field);
    const twitter=tags(html,'meta').filter(tag=>attr(tag,'name')==='twitter:'+field);
    assert.equal(og.length,1,'expected one og:'+field);
    assert.equal(twitter.length,1,'expected one twitter:'+field);
    assert.equal(attr(twitter[0],'content'),attr(og[0],'content'),
      field+' differs between social previews');
  }
  return true;
}

export function verifySitemapUrls(xml, expectedUrls) {
  assert.equal(typeof xml, 'string');
  assert.ok(Array.isArray(expectedUrls) && expectedUrls.length > 0);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(new Set(urls).size, urls.length, 'duplicate sitemap loc');
  assert.deepEqual([...urls].sort(), [...expectedUrls].sort(),
    'sitemap routes differ from the curated HTML route list');
  return true;
}

export function verifyRobotsSitemap(robotsTxt, sitemapUrl) {
  const entries = robotsTxt.match(/^Sitemap:\s*(\S+)\s*$/gm) ?? [];
  assert.equal(entries.length, 1, 'robots.txt must declare exactly one sitemap');
  assert.equal(entries[0].trim(), 'Sitemap: ' + sitemapUrl);
  return true;
}
