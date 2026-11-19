import { createHash } from 'node:crypto';
import { lstat, realpath, readdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publicFaiscaEnabled } from '../lab/lab-policy.mjs';

export const PUBLIC_LEAK_GATE_SCHEMA = 'faisca.public-dist-leak-gate.v1';
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MAX_FILES = 350;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 160 * 1024 * 1024;
const textFile = /\.(?:html|js|css|json|xml|txt|webmanifest|map)$/i;
const APPROVED_MASCOT_SHA256 =
  '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d';

// No generic ban on the word "Faísca" or ordinary editorial mentions.
// These exact strings represent a private implementation or action surface.
const forbiddenContent = Object.freeze([
  /__faisca_preview\//i,
  /data-faisca-private-(?:entry|inline)/i,
  /data-faisca-inline-frame/i,
  /(?:src|href)=["'](?:\/)?(?:ops\/faisca|faisca-review-server)/i,
  /faisca\.static-review-bundle\.v1/i,
  /faisca\.commercial-private-composite\.v1/i,
  /Faisca_R21_AUDIT\.json/i,
  /Faisca_Demonstracao_Guiada\.html/i,
  /faisca-review-server\.mjs/i
]);
const forbiddenPath = /(^|\/)(?:__faisca_preview|faisca-review-server\.mjs|Faisca_R21_AUDIT\.json|Faisca_Demonstracao_Guiada\.html|ops\/faisca)(\/|$)/i;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * Release gate for the PUBLIC Astro dist, not a staging switch. A lab bundle
 * must never reach an indexable artifact by accident, even if the build
 * succeeds and all isolated Faísca tests are green.
 */
export async function auditPublicFaiscaDist({ distDir = resolve(sourceRoot, 'dist') } = {}) {
  if (publicFaiscaEnabled !== false) {
    throw new Error('R26: approved public Faísca flag changed; release requires a separate GO.');
  }
  if (typeof distDir !== 'string' || !distDir.length) {
    throw new TypeError('R26: a compiled Astro dist directory is required.');
  }
  const root = resolve(distDir);
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) {
    throw new Error('R26: dist must be a real, non-symlinked directory.');
  }
  const paths = new Set();
  let bytesChecked = 0, filesChecked = 0, textFilesChecked = 0;
  async function walk(folder, prefix = '') {
    for (const dirent of await readdir(folder, { withFileTypes: true })) {
      const path = prefix + dirent.name;
      if (dirent.isSymbolicLink()) throw new Error('R26: symlinks forbidden in public dist.');
      if (dirent.isDirectory()) {
        if (forbiddenPath.test(path)) throw new Error('R26: private Faísca directory in public dist.');
        await walk(resolve(folder, dirent.name), path + '/');
        continue;
      }
      if (!dirent.isFile() || paths.has(path) || forbiddenPath.test(path)) {
        throw new Error('R26: unapproved file or private Faísca asset in public dist.');
      }
      paths.add(path);
      if (++filesChecked > MAX_FILES) throw new Error('R26: public output file limit exceeded.');
      const handle = await open(resolve(folder, dirent.name), constants.O_RDONLY | constants.O_NOFOLLOW);
      let data;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES ||
            bytesChecked + stat.size > MAX_TOTAL_BYTES) {
          throw new Error('R26: public dist byte limit exceeded.');
        }
        data = await handle.readFile();
        if (data.length !== stat.size) throw new Error('R26: output mutated during audit.');
      } finally { await handle.close(); }
      bytesChecked += data.length;
      if (sha(data) === APPROVED_MASCOT_SHA256) {
        throw new Error('R26: the unpublished approved Faísca mascot is in public dist.');
      }
      if (textFile.test(path)) {
        textFilesChecked++;
        const body = new TextDecoder('utf-8', { fatal: true }).decode(data);
        if (forbiddenContent.some(pattern => pattern.test(body))) {
          throw new Error('R26: private Faísca code or preview marker leaked into public dist.');
        }
      }
    }
  }
  await walk(root);
  if (!paths.has('index.html') || !paths.has('robots.txt') ||
      !paths.has('sitemap.xml') || !paths.has('404.html')) {
    throw new Error('R26: incomplete commercial build cannot pass release leakage audit.');
  }
  return Object.freeze({
    schema: PUBLIC_LEAK_GATE_SCHEMA,
    inspectedScope: 'compiled_public_dist_only',
    filesChecked, textFilesChecked, bytesChecked,
    publicFaiscaEnabled: false, privateFaiscaAssetsDetected: false,
    productionPublished: false, operationalEffects: false
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--audit-dist') {
    throw new Error('Usage: node ops/faisca/composition/public-release-gate.mjs --audit-dist');
  }
  const result = await auditPublicFaiscaDist();
  process.stdout.write(JSON.stringify(result) + '\n');
}
