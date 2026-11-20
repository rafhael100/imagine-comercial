import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditPublicFaiscaDist } from '../ops/faisca/composition/public-release-gate.mjs';

async function syntheticPublicDist(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r124-public-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, value] of Object.entries({
    'index.html': '<!doctype html><html lang="pt-BR"><title>Imagine</title><p>Conheça nossos serviços.</p></html>',
    'robots.txt': 'User-agent: *\nAllow: /\n',
    'sitemap.xml': '<?xml version="1.0"?><urlset></urlset>',
    '404.html': '<!doctype html><p>Página não encontrada</p>'
  })) await writeFile(join(dir, name), value);
  return dir;
}

test('R124 legitimate public editorial can mention Faísca without exposing a private surface', async t => {
  const dir = await syntheticPublicDist(t);
  await writeFile(join(dir, 'index.html'),
    '<html lang="pt-BR"><p>Faísca é um projeto de atendimento da Imagine.</p></html>');
  const ok = await auditPublicFaiscaDist({ distDir: dir });
  assert.equal(ok.publicFaiscaEnabled, false);
  assert.equal(ok.privateFaiscaAssetsDetected, false);
  assert.equal(ok.productionPublished, false);
});

for (const [path, marker] of [
  ['index.html', '/__faisca_openai_private/review'],
  ['index.html', '/__faisca_openai_private/mascot.png'],
  ['bundle.js', 'const API = "/__faisca_openai_private/converse";'],
  ['bundle.css', '/* __faisca_openai_private/review.css */'],
  ['config.json', '{"schema":"faisca.openai-private-conversation-response.v1"}'],
  ['index.html', 'FAISCA_REVIEW_BEARER_TOKEN'],
  ['bundle.js', 'FAISCA_PRIVATE_LEDGER_DIR']
]) {
  test('R124 public leak audit rejects private OpenAI code marker in ' + path + ': ' + marker, async t => {
    const dir = await syntheticPublicDist(t);
    await writeFile(join(dir, path), marker);
    await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
      /private Faísca code or preview marker leaked/);
  });
}

test('R124 public leak audit rejects an accidentally copied private OpenAI endpoint directory', async t => {
  const dir = await syntheticPublicDist(t);
  const privateDir = join(dir, '__faisca_openai_private');
  await mkdir(privateDir);
  await writeFile(join(privateDir, 'review.html'), '<html><h1>private only</h1></html>');
  await assert.rejects(auditPublicFaiscaDist({ distDir: dir }),
    /private Faísca directory in public dist/);
});
