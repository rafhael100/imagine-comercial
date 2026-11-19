import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  PORTABLE_DIST_SCHEMA, snapshotPortablePublicDist, verifyPortablePublicDist
} from '../ops/faisca/composition/portable-verify.mjs';
import { PORTABLE_LAUNCH_SCHEMA, startPortablePrivateReview } from '../ops/faisca/composition/portable-launcher.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r29-portable-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dist = join(dir, 'dist');
  await mkdir(dist, { recursive: true });
  const files = new Map([
    ['index.html', '<!doctype html><html lang="pt-BR"><main>Imagine</main></html>'],
    ['404.html', '<!doctype html><html lang="pt-BR"><main>404</main></html>'],
    ['robots.txt', 'User-agent: *\nAllow: /\n'],
    ['sitemap.xml', '<?xml version="1.0"?><urlset/>'],
    ['_astro/main.TEST.js', 'document.documentElement.dataset.preview="test";']
  ]);
  for (const [path, value] of files) {
    const target = join(dist, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, value);
  }
  return { dir, dist };
}

async function manifestFor(dir, dist) {
  const manifest = await snapshotPortablePublicDist({ directory: dist });
  const manifestPath = join(dir, 'Faisca_R29_DIST_SHA256.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { manifest, manifestPath };
}

test('R29 produces deterministic integrity manifest with no secret-bearing payload fields', async t => {
  const { dir, dist } = await fixture(t);
  const { manifest, manifestPath } = await manifestFor(dir, dist);
  assert.equal(manifest.schema, PORTABLE_DIST_SCHEMA);
  assert.equal(manifest.fileCount, 5);
  assert.ok(manifest.bytes > 100);
  assert.equal(manifest.publicFaiscaEnabled, false);
  assert.equal(manifest.operationalEffects, false);
  assert.equal(manifest.productionPublished, false);
  assert.equal(Object.isFrozen(manifest), true);
  assert.ok(manifest.files.every(item => Object.isFrozen(item)));
  assert.ok(manifest.files.every(item => /^[a-f0-9]{64}$/.test(item.sha256)));
  assert.ok(manifest.files.every(item => !Object.hasOwn(item, 'content')));
  const verified = await verifyPortablePublicDist({ directory: dist, manifestPath });
  assert.deepEqual(verified, manifest);
  assert.deepEqual(
    (await snapshotPortablePublicDist({ directory: dist })).files.map(x => x.path),
    verified.files.map(x => x.path)
  );
  assert.equal(PORTABLE_LAUNCH_SCHEMA, 'faisca.commercial-portable-review.v1');
});

test('R29 refuses file tampering even when file byte length is unchanged', async t => {
  const { dir, dist } = await fixture(t);
  const { manifestPath } = await manifestFor(dir, dist);
  const path = join(dist, '_astro/main.TEST.js');
  const old = await readFile(path);
  const altered = Buffer.from(old);
  altered[0] ^= 1;
  await writeFile(path, altered);
  await assert.rejects(verifyPortablePublicDist({ directory: dist, manifestPath }),
    /differs from the approved review snapshot/);
  await writeFile(path, old);
  await verifyPortablePublicDist({ directory: dist, manifestPath });
});

test('R29 rejects extra files, removed routes, symlink and corrupt manifest', async t => {
  const { dir, dist } = await fixture(t);
  const { manifestPath } = await manifestFor(dir, dist);
  await writeFile(join(dist, 'rogue.txt'), 'unreviewed file');
  await assert.rejects(verifyPortablePublicDist({ directory: dist, manifestPath }), /differs/);
  await rm(join(dist, 'rogue.txt'));
  await rm(join(dist, 'robots.txt'));
  await assert.rejects(verifyPortablePublicDist({ directory: dist, manifestPath }), /incomplete public Comercial dist/);
  await writeFile(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  await symlink(join(dist, 'index.html'), join(dist, 'rogue-link.html'));
  await assert.rejects(verifyPortablePublicDist({ directory: dist, manifestPath }), /symlink/);
  await rm(join(dist, 'rogue-link.html'));
  const data = JSON.parse(await readFile(manifestPath, 'utf8'));
  data.productionPublished = true;
  await writeFile(manifestPath, JSON.stringify(data));
  await assert.rejects(verifyPortablePublicDist({ directory: dist, manifestPath }),
    /private review manifest is invalid/);
});

test('R29 refuses missing ZIP or invalid password without listening on any port', async t => {
  const { dir } = await fixture(t);
  await assert.rejects(startPortablePrivateReview({ folder: dir, password: 'short' }), TypeError);
  await assert.rejects(startPortablePrivateReview({
    folder: dir, password: 'A_SYNTHEtIC_PASSPHRASE_24_OR_MORE'
  }), /ENOENT/);
});
