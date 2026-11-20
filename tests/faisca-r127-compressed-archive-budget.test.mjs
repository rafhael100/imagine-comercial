import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { auditPublicFaiscaDist } from '../ops/faisca/composition/public-release-gate.mjs';

async function syntheticDist(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r127-compression-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries({
    'index.html': '<!doctype html><title>Imagine</title>',
    'robots.txt': 'User-agent: *\\nAllow: /\\n',
    'sitemap.xml': '<urlset></urlset>',
    '404.html': '<!doctype html><title>404</title>'
  })) await writeFile(join(dir, name), content);
  return dir;
}
const compressor = { gz: gzipSync, br: brotliCompressSync };

for (const [inner, outer] of [['gz', 'br'], ['br', 'gz'], ['gz', 'gz'], ['br', 'br']]) {
  test('R127 rejects private content under nested compression: ' + inner + '.' + outer, async t => {
    const dir = await syntheticDist(t);
    const bytes = Buffer.from('FAISCA_REVIEW_BEARER_TOKEN');
    const compressed = compressor[outer](compressor[inner](bytes));
    await writeFile(join(dir, 'bundle.js.' + inner + '.' + outer), compressed);
    await assert.rejects(auditPublicFaiscaDist({ distDir: dir }), /nested compressed public artifacts/);
  });
}

test('R127 rejects a disguised second gzip layer inside a single .gz filename', async t => {
  const dir = await syntheticDist(t);
  await writeFile(join(dir, 'bundle.js.gz'),
    gzipSync(gzipSync(Buffer.from('/__faisca_openai_private/converse'))));
  await assert.rejects(auditPublicFaiscaDist({ distDir: dir }), /nested gzip payload/);
});

test('R127 caps total decompressed bytes even when each asset is below 12 MiB', async t => {
  const dir = await syntheticDist(t);
  const compressed = gzipSync(Buffer.alloc(11 * 1024 * 1024, 0x61));
  for (let i = 0; i < 15; i++) {
    await writeFile(join(dir, 'bundle-' + i + '.dat.gz'), compressed);
  }
  await assert.rejects(auditPublicFaiscaDist({ distDir: dir }), /total decompressed public dist byte limit/);
});

test('R127 still allows ordinary single-layer synthetic editorial JS in gzip and Brotli', async t => {
  const dir = await syntheticDist(t);
  const js = Buffer.from('const text = "Faísca: revisão privada, sem atendimento público.";');
  await writeFile(join(dir, 'bundle.js.gz'), gzipSync(js));
  await writeFile(join(dir, 'bundle.js.br'), brotliCompressSync(js));
  const report = await auditPublicFaiscaDist({ distDir: dir });
  assert.equal(report.publicFaiscaEnabled, false);
  assert.equal(report.productionPublished, false);
  assert.equal(report.expandedBytesChecked, 2 * js.byteLength);
});
