import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditPublicFaiscaDist, PUBLIC_LEAK_GATE_SCHEMA
} from '../ops/faisca/composition/public-release-gate.mjs';

async function clean(t) {
  const folder = await mkdtemp(join(tmpdir(), 'faisca-r26-public-'));
  t.after(() => rm(folder, { force: true, recursive: true }));
  await writeFile(join(folder, 'index.html'),
    '<!doctype html><html lang="pt-BR"><title>Imagine</title><main>Serviços</main></html>');
  await writeFile(join(folder, '404.html'), '<!doctype html><html><title>Não encontrado</title></html>');
  await writeFile(join(folder, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  await writeFile(join(folder, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>');
  await mkdir(join(folder, '_astro'));
  await writeFile(join(folder, '_astro', 'index.ABC.js'), 'document.body.dataset.imagine="yes";');
  await writeFile(join(folder, '_astro', 'style.ABC.css'), '.shell{display:grid}');
  return folder;
}

test('R26 approves a normal compiled public dist with no private Faísca payload', async t => {
  const distDir = await clean(t);
  const result = await auditPublicFaiscaDist({ distDir });
  assert.equal(result.schema, PUBLIC_LEAK_GATE_SCHEMA);
  assert.equal(result.inspectedScope, 'compiled_public_dist_only');
  assert.equal(result.publicFaiscaEnabled, false);
  assert.equal(result.privateFaiscaAssetsDetected, false);
  assert.equal(result.productionPublished, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.filesChecked, 6);
  assert.equal(result.textFilesChecked, 6);
  assert.ok(result.bytesChecked > 50);
  assert.equal(Object.isFrozen(result), true);
});

test('R26 fails if staging URLs or assistant controls appear in public HTML or scripts', async t => {
  const distDir = await clean(t);
  const file = join(distDir, 'index.html');
  for (const marker of [
    '/__faisca_preview/journey/', 'data-faisca-private-entry',
    'data-faisca-private-inline', 'data-faisca-inline-frame',
    'faisca.static-review-bundle.v1', 'Faisca_R21_AUDIT.json'
  ]) {
    await writeFile(file, '<!doctype html><html><main>' + marker + '</main></html>');
    await assert.rejects(auditPublicFaiscaDist({ distDir }), /private Faísca code or preview marker/,
      marker);
  }
  await writeFile(file, '<!doctype html><html><main>Imagine</main></html>');
  const script = join(distDir, '_astro', 'index.ABC.js');
  await writeFile(script, 'const debug = "/__faisca_preview/support/";');
  await assert.rejects(auditPublicFaiscaDist({ distDir }), /private Faísca code or preview marker/);
});

test('R26 rejects artifacts or directories named after private Faísca deliverables', async t => {
  const distDir = await clean(t);
  await mkdir(join(distDir, '__faisca_preview'));
  await assert.rejects(auditPublicFaiscaDist({ distDir }), /private Faísca directory/);
  await rm(join(distDir, '__faisca_preview'), { recursive: true });
  await writeFile(join(distDir, 'Faisca_R21_AUDIT.json'), '{}');
  await assert.rejects(auditPublicFaiscaDist({ distDir }), /unapproved file or private Faísca asset/);
});

test('R26 rejects the exact approved mascot PNG appearing in a public binary asset', async t => {
  const distDir = await clean(t);
  const actual = await readFile(new URL('../ops/faisca/assets/faisca-master.png', import.meta.url));
  await writeFile(join(distDir, 'some-logo.png'), actual);
  await assert.rejects(auditPublicFaiscaDist({ distDir }), /unpublished approved Faísca mascot/);
});

test('R26 rejects symlinked output, missing essential pages and incomplete generated site', async t => {
  const distDir = await clean(t);
  await rm(join(distDir, 'sitemap.xml'));
  await assert.rejects(auditPublicFaiscaDist({ distDir }), /incomplete commercial build/);
  await writeFile(join(distDir, 'sitemap.xml'), '<urlset/>');
  await symlink(join(distDir, '_astro', 'index.ABC.js'),
    join(distDir, '_astro', 'alias.js'));
  await assert.rejects(auditPublicFaiscaDist({ distDir }), /symlinks forbidden/);
  const link = distDir + '-alias';
  t.after(() => rm(link, { force: true }));
  await symlink(distDir, link, 'dir');
  await assert.rejects(auditPublicFaiscaDist({ distDir: link }), /non-symlinked directory/);
});
