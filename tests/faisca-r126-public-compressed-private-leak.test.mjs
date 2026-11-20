import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { auditPublicFaiscaDist } from '../ops/faisca/composition/public-release-gate.mjs';

async function syntheticDist(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r126-compressed-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries({
    'index.html': '<!doctype html><title>Imagine</title>',
    'robots.txt': 'User-agent: *\\nAllow: /\\n',
    'sitemap.xml': '<urlset></urlset>',
    '404.html': '<!doctype html><title>404</title>'
  })) await writeFile(join(dir, name), text);
  return dir;
}

for (const [extension, compress] of [
  ['gz', gzipSync],
  ['br', brotliCompressSync]
]) {
  test('R126 denies a private endpoint embedded in compressed public JS: ' + extension, async t => {
    const dir = await syntheticDist(t);
    const hidden = 'const endpoint = "/__faisca_openai_private/converse";';
    await writeFile(join(dir, 'bundle.js.' + extension), compress(Buffer.from(hidden)));
    await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
      /private Faísca code or preview marker leaked/);
  });

  test('R126 denies compressed private bearer configuration: ' + extension, async t => {
    const dir = await syntheticDist(t);
    await writeFile(join(dir, 'bundle.dat.' + extension),
      compress(Buffer.from('FAISCA_REVIEW_BEARER_TOKEN')));
    await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
      /private Faísca code or preview marker leaked/);
  });

  test('R126 permits reviewed ordinary compressed public editorial: ' + extension, async t => {
    const dir = await syntheticDist(t);
    await writeFile(join(dir, 'index.html.' + extension),
      compress(Buffer.from('<html><p>Faísca é um projeto em laboratório.</p></html>')));
    const report = await auditPublicFaiscaDist({ distDir: dir });
    assert.equal(report.publicFaiscaEnabled, false);
    assert.equal(report.productionPublished, false);
    assert.equal(report.privateFaiscaAssetsDetected, false);
  });
}

test('R126 rejects a malformed gzip payload instead of skipping inspection', async t => {
  const dir = await syntheticDist(t);
  await writeFile(join(dir, 'bundle.js.gz'), Buffer.from('not a gzip stream'));
  await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
    /invalid or oversized compressed public artifact/);
});

test('R126 aborts decompression of a gzip bomb beyond the bounded asset limit', async t => {
  const dir = await syntheticDist(t);
  await writeFile(join(dir, 'bundle.js.gz'),
    gzipSync(Buffer.alloc(12 * 1024 * 1024 + 1, 0x61)));
  await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
    /invalid or oversized compressed public artifact/);
});

test('R126 rejects malformed UTF-8 in decompressed HTML', async t => {
  const dir = await syntheticDist(t);
  await writeFile(join(dir, 'bundle.html.br'),
    brotliCompressSync(Buffer.from([0xc3, 0x28])));
  await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
    /encoded|valid|utf|character|decode/i);
});
