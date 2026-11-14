/**
 * F22 — inventário reproduzível do build Astro para revisão, nunca autorização.
 * SHA-256 detecta divergência de bytes entre duas cópias; não autentica o emissor.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sitePages} from '../data/services.mjs';

const allowedExtensions = new Set([
  'html', 'xml', 'txt', 'css', 'js', 'svg',
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'ico', 'woff', 'woff2'
]);
const maxFiles = 500;
const maxFileBytes = 10 * 1024 * 1024;
const maxTotalBytes = 50 * 1024 * 1024;
const mandatoryFiles = Object.freeze(['404.html', 'robots.txt', 'sitemap.xml']);

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedHtml = routes => {
  assert.ok(Array.isArray(routes) && routes.length > 0, 'review: expected public routes');
  const pages = routes.map(route => {
    assert.match(route, /^\/(?:[a-z0-9-]+\/)*$/, 'review: invalid curated route');
    return route === '/' ? 'index.html' : route.slice(1) + 'index.html';
  });
  assert.equal(new Set(pages).size, pages.length, 'review: duplicate curated public route');
  return pages.sort();
};
function validateRelativePath(path) {
  if (typeof path !== 'string' || !path.length ||
      !/^[a-zA-Z0-9_-]+(?:[./_-][a-zA-Z0-9_-]+)*(?:\/[a-zA-Z0-9_-]+(?:[._-][a-zA-Z0-9_-]+)*)*$/.test(path) ||
      path.split('/').some(segment => segment === '.' || segment === '..' || segment.startsWith('.'))) {
    throw new Error('review: invalid relative file path');
  }
  if (path === '_redirects' || path === '_headers' || path.startsWith('.well-known/') ||
      /(?:^|\/)(?:_redirects|_headers|wrangler\.toml|package-lock\.json|package\.json)$/i.test(path)) {
    throw new Error('review: deployment rules or source metadata are forbidden');
  }
  const extension = path.split('.').at(-1).toLowerCase();
  if (!allowedExtensions.has(extension)) throw new Error('review: disallowed output file type');
}

export function createReleaseReview(files, {routes = sitePages.map(page => page.path)} = {}) {
  assert.ok(Array.isArray(files) && files.length > 0 && files.length <= maxFiles,
    'review: invalid number of output files');
  const seen = new Set();
  let totalBytes = 0;
  const entries = files.map(file => {
    assert.ok(file && typeof file === 'object', 'review: invalid file record');
    validateRelativePath(file.path);
    if (seen.has(file.path)) throw new Error('review: duplicated output file');
    seen.add(file.path);
    if (!Buffer.isBuffer(file.bytes)) throw new Error('review: bytes must be a Buffer');
    if (file.bytes.byteLength > maxFileBytes) throw new Error('review: output file too large');
    totalBytes += file.bytes.byteLength;
    if (totalBytes > maxTotalBytes) throw new Error('review: combined output size too large');
    return Object.freeze({
      path: file.path,
      size: file.bytes.byteLength,
      sha256: sha256(file.bytes)
    });
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);

  for (const filename of mandatoryFiles) {
    if (!seen.has(filename)) throw new Error('review: missing required output file: ' + filename);
  }
  const expected = [...expectedHtml(routes), '404.html'].sort();
  const actual = entries.filter(file => file.path.endsWith('.html')).map(file => file.path);
  assert.deepEqual(actual, expected, 'review: unexpected or missing HTML output');
  // Digest can be compared against a separately trusted version; it is not a signature.
  const treeSha256 = sha256(Buffer.from(JSON.stringify(entries), 'utf8'));
  return Object.freeze({
    schema: 'imagine.comercial.release-review.v1',
    mode: 'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
    origin: 'https://imaginecomunicacao.com.br/',
    htmlPages: expected.length - 1,
    fileCount: entries.length,
    totalBytes,
    treeSha256,
    files: Object.freeze(entries)
  });
}
export function verifyReleaseReview(files, saved, options) {
  assert.deepEqual(saved, createReleaseReview(files, options),
    'review: manifest does not match current output bytes');
  return true;
}
