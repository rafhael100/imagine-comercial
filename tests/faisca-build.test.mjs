import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildDemo, inlineModule } from '../ops/faisca/build-demo.mjs';

const digest = (data, encoding = 'hex') => createHash('sha256').update(data).digest(encoding);
const assetURL = new URL('../ops/faisca/assets/faisca-master.png', import.meta.url);

test('standalone preview preserves approved asset bytes and exact CSP hashes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-build-review-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const out = join(directory, 'preview.html');
  const result = await buildDemo({ out });
  const html = await readFile(out, 'utf8');
  const original = await readFile(assetURL);
  const embedded = [...html.matchAll(/src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/g)];
  assert.equal(embedded.length, 1, 'one original master is embedded; avatars reuse it');
  assert.deepEqual(Buffer.from(embedded[0][1], 'base64'), original, 'image is not cropped, recolored or regenerated');
  assert.equal(result.image_sha256, digest(original));
  assert.equal(result.bytes, Buffer.byteLength(html));
  assert.equal(result.sha256, digest(html));
  assert.equal(result.mode, 'guided_demo');

  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  assert.equal(scripts.length, 1);
  assert.equal(styles.length, 1);
  const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  assert.ok(policy, 'standalone document has a CSP');
  const directives = new Map(policy.split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const [name, ...values] = item.split(/\s+/);
    return [name, values];
  }));
  assert.deepEqual(directives.get('script-src'), [`'sha256-${digest(scripts[0][1], 'base64')}'`]);
  assert.deepEqual(directives.get('style-src'), [`'sha256-${digest(styles[0][1], 'base64')}'`]);
  for (const name of ['default-src', 'connect-src', 'form-action', 'object-src', 'base-uri']) {
    assert.deepEqual(directives.get(name), ["'none'"], name);
  }
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|https?:/);
  assert.doesNotMatch(html, /__FAISCA_[A-Z_]+__/);
  assert.doesNotThrow(() => new Function(scripts[0][1]), 'bundled JavaScript must parse; it is not executed by this test');
});

test('an altered approved image is rejected before writing any preview output', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-asset-review-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const corrupted = Buffer.from(await readFile(assetURL));
  corrupted[corrupted.length - 1] ^= 1;
  const assetPath = join(directory, 'altered.png');
  const out = join(directory, 'not-created', 'preview.html');
  await writeFile(assetPath, corrupted);
  await assert.rejects(buildDemo({ out, assetPath }), /master differs from the approved image/);
  await assert.rejects(stat(out), { code: 'ENOENT' });
  await assert.rejects(stat(join(directory, 'not-created')), { code: 'ENOENT' });
});

test('standalone bundling rejects unexpected dependencies instead of silently dropping them', () => {
  assert.equal(inlineModule("export const greeting = 'olá';"), "const greeting = 'olá';");
  const expected = "import { respond } from './core.mjs';\nconst answer = respond;";
  assert.equal(inlineModule(expected, './core.mjs'), 'const answer = respond;');
  for (const source of [
    "import { unexpected } from './unreviewed.mjs';\nconst answer = 1;",
    "import { unexpected } from './unreviewed.mjs';\nimport { respond } from './core.mjs';\nconst answer = respond;",
    "import { respond } from './core.mjs';\nimport { unexpected } from './unreviewed.mjs';\nconst answer = respond;",
    "import './side-effect.mjs';\nconst answer = 1;",
    "const answer = import('./late.mjs');"
  ]) {
    assert.throws(() => inlineModule(source, './core.mjs'), /Unexpected import/, source);
  }
});
