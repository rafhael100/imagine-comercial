import { createHash } from 'node:crypto';
import { lstat, realpath, readdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { publicFaiscaEnabled } from '../lab/lab-policy.mjs';

export const PUBLIC_LEAK_GATE_SCHEMA = 'faisca.public-dist-leak-gate.v1';
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MAX_FILES = 350;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 160 * 1024 * 1024;
const compressedFile = /\.(?:gz|br)$/i;
const nestedCompressedFile = /(?:\.(?:gz|br)){2,}$/i;
const textFile = /\.(?:html|js|css|json|xml|txt|webmanifest|map)$/i;
const APPROVED_MASCOT_SHA256 =
  '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d';

// No generic ban on the word "Faísca" or ordinary editorial mentions.
// These exact strings represent a private implementation or action surface.
const forbiddenContent = Object.freeze([
  /__faisca_preview\//i,
  // Never allow the paid/private OpenAI review interface, its route names,
  // bearer configuration or model-response contracts into public Astro HTML.
  /__faisca_openai_private(?:\/|\b)/i,
  /faisca\.openai-private-(?:review|conversation)-response\.v1/i,
  /FAISCA_REVIEW_BEARER_TOKEN|FAISCA_PRIVATE_LEDGER_DIR/i,
  /data-faisca-private-(?:entry|inline)/i,
  /data-faisca-inline-frame/i,
  /(?:src|href)=["'](?:\/)?(?:ops\/faisca|faisca-review-server)/i,
  /faisca\.static-review-bundle\.v1/i,
  /faisca\.commercial-private-composite\.v1/i,
  /Faisca_R21_AUDIT\.json/i,
  /Faisca_Demonstracao_Guiada\.html/i,
  /faisca-review-server\.mjs/i
]);
const forbiddenPath = /(^|\/)(?:__faisca_preview|__faisca_openai_private|faisca-review-server\.mjs|Faisca_R21_AUDIT\.json|Faisca_Demonstracao_Guiada\.html|ops\/faisca)(\/|$)/i;
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
  let expandedBytesChecked = 0;
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
      // The public dist can contain opaque assets and source copied under
      // unexpected extensions (.mjs, .svg, .log, .wasm, .dat, etc.). Scanning
      // only recognized UTF-8 text extensions silently misses ASCII private
      // routes and configuration markers inside those files. Inspect the raw
      // bytes of EVERY output file before deciding whether to decode it.
      // latin1 preserves ASCII bytes, including in otherwise binary payloads.
      // This is a lexical defense, not a decompressor or a secret scanner.
      const raw = data.toString('latin1');
      if (forbiddenContent.some(pattern => pattern.test(raw))) {
        throw new Error('R26: private Faísca code or preview marker leaked into public dist.');
      }
      if (compressedFile.test(path)) {
        // Two-stage .gz/.br assets are unnecessary for this reviewed public
        // release. One-level inspection would let a private route survive
        // inside the inner layer; fail closed rather than guessing the
        // origin's Content-Encoding chain.
        if (nestedCompressedFile.test(path)) {
          throw new Error('R26: nested compressed public artifacts are forbidden.');
        }
        // CDNs may serve precompressed public HTML/JS. Plain-byte scanning
        // cannot see private route markers concealed by gzip or Brotli.
        // Bound decompression to a single public file's uncompressed limit.
        let expanded;
        try {
          expanded = /\.br$/i.test(path)
            ? brotliDecompressSync(data, { maxOutputLength: MAX_FILE_BYTES })
            : gunzipSync(data, { maxOutputLength: MAX_FILE_BYTES });
        } catch {
          throw new Error('R26: invalid or oversized compressed public artifact.');
        }
        // A crafted archive can inflate to almost 12 MiB per file. Enforce
        // a cumulative bound as well, not only an individual-file bound.
        expandedBytesChecked += expanded.length;
        if (expandedBytesChecked > MAX_TOTAL_BYTES) {
          throw new Error('R26: total decompressed public dist byte limit exceeded.');
        }
        // Catch a second gzip layer even when the filename lies about it.
        if (expanded.length >= 3 && expanded[0] === 0x1f &&
            expanded[1] === 0x8b && expanded[2] === 0x08) {
          throw new Error('R26: nested gzip payload is forbidden.');
        }
        if (forbiddenContent.some(pattern => pattern.test(expanded.toString('latin1')))) {
          throw new Error('R26: private Faísca code or preview marker leaked into public dist.');
        }
        // Also keep the fail-closed UTF-8 policy for compressed web text.
        const originalPath = path.replace(compressedFile, '');
        if (textFile.test(originalPath)) {
          new TextDecoder('utf-8', { fatal: true }).decode(expanded);
        }
      }
      if (textFile.test(path)) {
        textFilesChecked++;
        // Preserve the existing fail-closed rule for malformed UTF-8 in
        // recognized web text assets.
        new TextDecoder('utf-8', { fatal: true }).decode(data);
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
    filesChecked, textFilesChecked, bytesChecked, expandedBytesChecked,
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
