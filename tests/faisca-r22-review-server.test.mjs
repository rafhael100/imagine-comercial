import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { auditFaiscaLabBuild, REVIEW_ROUTES } from '../ops/faisca/review/build-review.mjs';
import { startReviewServer, loadReviewSnapshot } from '../ops/faisca/review/static-server.mjs';

const approvedImage = Buffer.from('R22 synthetic mascot to verify artifact integrity');
const digest = value => createHash('sha256').update(value).digest('hex');
const html = () => '<!doctype html><html lang="pt-BR"><head>' +
  '<meta name="robots" content="noindex,nofollow,noarchive">' +
  '<meta name="referrer" content="no-referrer"></head><body>' +
  '<img src="data:image/png;base64,' + approvedImage.toString('base64') + '">' +
  '</body></html>';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r22-static-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const staticRoot = join(root, 'astro');
  for (const route of REVIEW_ROUTES) {
    await mkdir(dirname(join(staticRoot, route)), { recursive: true });
    await writeFile(join(staticRoot, route), html());
  }
  const assetPath = join(staticRoot, '_astro', 'app.HASH.js');
  await mkdir(dirname(assetPath), { recursive: true });
  await writeFile(assetPath, 'window.__onlyStaticReview=true;');
  const report = await auditFaiscaLabBuild({
    root: staticRoot, expectedImageSha256: digest(approvedImage)
  });
  await writeFile(join(root, 'Faisca_R21_AUDIT.json'), JSON.stringify(report));
  return { root, assetPath };
}

function requestWithHost(origin, hostHeader) {
  return new Promise((yes, no) => {
    const url = new URL(origin);
    const req = httpRequest({
      hostname: '127.0.0.1', port: url.port, path: '/journey/',
      method: 'GET', headers: { Host: hostHeader }
    }, res => {
      res.resume();
      res.on('end', () => yes(res.statusCode));
    });
    req.on('error', no);
    req.end();
  });
}

test('R22 serves only guided, local qualification and support pages with restrictive headers', async t => {
  const { root } = await fixture(t);
  const review = await startReviewServer({ rootDir: root, enabled: '1' });
  t.after(() => review.close());
  assert.match(review.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(review.mode, 'local_static_only');
  for (const route of ['/', '/journey/', '/support/']) {
    const response = await fetch(review.origin + route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.match(await response.text(), /Mascote|<html/);
  }
  const script = await fetch(review.origin + '/_astro/app.HASH.js');
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.match(await script.text(), /__onlyStaticReview/);
});

test('R22 denies PHP-dependent paths, APIs, unsupported methods, invalid host and encoded paths', async t => {
  const { root } = await fixture(t);
  const review = await startReviewServer({ rootDir: root, enabled: '1' });
  t.after(() => review.close());
  for (const url of [
    '/http/', '/grounded/', '/journey-http/', '/journey-http-r08/',
    '/__faisca_lab/sessions', '/admin/', '/favicon.ico', '/.env'
  ]) {
    const response = await fetch(review.origin + url);
    assert.equal(response.status, 404, url);
  }
  for (const url of ['/journey/?token=anything', '/%2e%2e/', '/_astro/%2e%2e/secrets']) {
    const response = await fetch(review.origin + url);
    assert.equal(response.status, 400, url);
  }
  const posted = await fetch(review.origin + '/journey/', { method: 'POST', body: 'test' });
  assert.equal(posted.status, 405);
  assert.equal(posted.headers.get('allow'), 'GET, HEAD');
  assert.equal(await requestWithHost(review.origin, 'evil.invalid'), 403);
  const head = await fetch(review.origin + '/support/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('R22 rejects edited assets, extra files and symlinks before binding any socket', async t => {
  const { root, assetPath } = await fixture(t);
  const old = await readFile(assetPath);
  await writeFile(assetPath, 'window.modified=true;');
  await assert.rejects(startReviewServer({ rootDir: root, enabled: '1' }), /digest differs/);
  await writeFile(assetPath, old);
  await writeFile(join(root, 'astro', 'unknown.txt'), 'do not serve this');
  await assert.rejects(loadReviewSnapshot(root), /Unexpected file/);
  await rm(join(root, 'astro', 'unknown.txt'));
  await symlink(assetPath, join(root, 'astro', '_astro', 'alias.js'));
  await assert.rejects(loadReviewSnapshot(root), /Symlink/);
});

test('R22 requires explicit local enablement and never opens an externally bound host', async t => {
  const { root } = await fixture(t);
  await assert.rejects(startReviewServer({ rootDir: root }), TypeError);
  await assert.rejects(startReviewServer({ rootDir: root, enabled: 'true' }), TypeError);
  await assert.rejects(startReviewServer({ rootDir: root, enabled: '1', port: 65536 }), TypeError);
});
