import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditPublicFaiscaDist } from '../ops/faisca/composition/public-release-gate.mjs';

async function syntheticDist(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r125-opaque-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, body] of Object.entries({
    'index.html': '<!doctype html><html lang="pt-BR"><title>Imagine</title></html>',
    'robots.txt': 'User-agent: *\\nAllow: /\\n',
    'sitemap.xml': '<urlset></urlset>',
    '404.html': '<!doctype html><title>404</title>'
  })) await writeFile(join(dir, name), body);
  return dir;
}

for (const [name, payload] of [
  ['module.mjs', 'export const endpoint = "/__faisca_openai_private/converse";'],
  ['vector.svg', '<svg><!-- FAISCA_PRIVATE_LEDGER_DIR --></svg>'],
  ['archive.log', 'FAISCA_REVIEW_BEARER_TOKEN'],
  ['map.dat', Buffer.concat([
    Buffer.from([0x00, 0xff, 0x81, 0x00]),
    Buffer.from('faisca.openai-private-conversation-response.v1')
  ])],
  ['module.wasm', Buffer.concat([
    Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    Buffer.from('/__faisca_openai_private/review')
  ])]
]) {
  test('R125 blocks private OpenAI marker in opaque public asset ' + name, async t => {
    const dist = await syntheticDist(t);
    await writeFile(join(dist, name), payload);
    await assert.rejects(
      auditPublicFaiscaDist({ distDir: dist }),
      /private Faísca code or preview marker leaked into public dist/
    );
  });
}

test('R125 rejects private route even within an opaque nested asset', async t => {
  const dist = await syntheticDist(t);
  await mkdir(join(dist, '_astro'));
  await writeFile(join(dist, '_astro', 'chunk.cache'),
    Buffer.concat([Buffer.from([0xff, 0x00]), Buffer.from('/__FAISCA_OPENAI_PRIVATE/RESPOND')]));
  await assert.rejects(
    auditPublicFaiscaDist({ distDir: dist }),
    /private Faísca code or preview marker leaked into public dist/
  );
});

test('R125 permits benign binary assets and normal public editorial text', async t => {
  const dist = await syntheticDist(t);
  await mkdir(join(dist, '_astro'));
  await writeFile(join(dist, '_astro', 'image.dat'),
    Buffer.from([0x00, 0xff, 0x80, 0x01, 0x02]));
  await writeFile(join(dist, 'vector.svg'),
    '<svg role="img"><title>Faísca, projeto editorial</title></svg>');
  const result = await auditPublicFaiscaDist({ distDir: dist });
  assert.equal(result.publicFaiscaEnabled, false);
  assert.equal(result.productionPublished, false);
  assert.equal(result.privateFaiscaAssetsDetected, false);
  assert.equal(result.filesChecked, 6);
});

test('R125 retains strict UTF-8 validation for known public text extensions', async t => {
  const dist = await syntheticDist(t);
  await writeFile(join(dist, '_astro.js'), Buffer.from([0xc3, 0x28]));
  await assert.rejects(
    auditPublicFaiscaDist({ distDir: dist }),
    /encoded|valid|utf|character|decode/i
  );
});
