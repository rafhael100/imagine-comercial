import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { auditPublicFaiscaDist } from '../ops/faisca/composition/public-release-gate.mjs';

async function syntheticDist(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r128-escaped-markers-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries({
    'index.html': '<!doctype html><title>Imagine</title>',
    'robots.txt': 'User-agent: *\nAllow: /\n',
    'sitemap.xml': '<urlset></urlset>',
    '404.html': '<!doctype html><title>404</title>'
  })) await writeFile(join(dir, name), content);
  return dir;
}

const escapedVariants = [
  ['unicode4', 'const endpoint="/\\u005f\\u005ffaisca_openai_private/converse";'],
  ['hex2', 'const endpoint="/\\x5f\\x5ffaisca_openai_private/converse";'],
  ['braced', 'const endpoint="/\\u{5f}\\u{5f}faisca_openai_private/converse";'],
  ['mixed', 'const endpoint="/\\x5f\\u005ffaisca_openai_private/converse";']
];

for (const [label, script] of escapedVariants) {
  test('R128 rejects escaped private route in public JS: ' + label, async t => {
    const dir = await syntheticDist(t);
    await writeFile(join(dir, 'bundle.js'), script);
    await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
      /private Faísca code or preview marker leaked/);
  });
}

test('R128 scans escaped route after gzip expansion', async t => {
  const dir = await syntheticDist(t);
  await writeFile(join(dir, 'bundle.js.gz'), gzipSync(Buffer.from(escapedVariants[0][1])));
  await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
    /private Faísca code or preview marker leaked/);
});

test('R128 permits ordinary textual escape sequences and approved editorial text', async t => {
  const dir = await syntheticDist(t);
  await writeFile(join(dir, 'bundle.js'),
    'const guide = "Faísca é um mascote em revisão"; const separator = "\\\\u005f";');
  const report = await auditPublicFaiscaDist({ distDir: dir });
  assert.equal(report.productionPublished, false);
  assert.equal(report.publicFaiscaEnabled, false);
});
