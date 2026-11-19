import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, lstat, open, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDemo } from '../build-demo.mjs';

export const REVIEW_SCHEMA = 'faisca.static-review-bundle.v1';
export const REVIEW_ROUTES = Object.freeze([
  'index.html', 'grounded/index.html', 'http/index.html',
  'journey/index.html', 'journey-http/index.html',
  'journey-http-r08/index.html', 'support/index.html'
]);
const routeSet = new Set(REVIEW_ROUTES);
const MAX_FILES = 64;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const outputRoot = resolve(projectRoot, 'output');
const sha256 = data => createHash('sha256').update(data).digest('hex');

function isReviewedAsset(path) {
  return /^_astro\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(path);
}

/** Verify the compiled separate laboratory BEFORE publishing its review archive.
 * The caller supplies an asset fingerprint from the checked-in approval
 * manifest, not from the compiled HTML itself.
 */
export async function auditFaiscaLabBuild({ root, expectedImageSha256 }) {
  if (typeof root !== 'string' || !/^[a-f0-9]{64}$/.test(expectedImageSha256)) {
    throw new TypeError('Approved image digest and laboratory build directory required.');
  }
  const base = resolve(root);
  if (!(await lstat(base)).isDirectory() || await realpath(base) !== base) {
    throw new Error('Review build must be a real, non-symlinked directory.');
  }
  const fileRecords = [];
  let totalBytes = 0;
  async function traverse(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      const absolute = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink is not allowed in a review bundle.');
      if (entry.isDirectory()) {
        if (prefix || !['_astro', 'grounded', 'http', 'journey', 'journey-http',
          'journey-http-r08', 'support'].includes(entry.name)) {
          throw new Error('Unreviewed directory in the Faísca preview.');
        }
        await traverse(absolute, path + '/');
        continue;
      }
      if (!entry.isFile() || (!routeSet.has(path) && !isReviewedAsset(path))) {
        throw new Error('Unreviewed file in the Faísca preview.');
      }
      if (fileRecords.length >= MAX_FILES) throw new Error('Review file-count limit exceeded.');
      const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES ||
          totalBytes + stat.size > MAX_TOTAL_BYTES) {
          throw new Error('Review byte limit exceeded.');
        }
        bytes = await handle.readFile();
        if (bytes.length !== stat.size) throw new Error('Preview file changed while reading.');
      } finally {
        await handle.close();
      }
      if (routeSet.has(path)) {
        const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (!/<html\b[^>]*lang="pt-BR"/i.test(html) ||
            !/<meta\b[^>]*name="robots"[^>]*content="noindex,nofollow,noarchive"/i.test(html) ||
            !/<meta\b[^>]*name="referrer"[^>]*content="no-referrer"/i.test(html)) {
          throw new Error('A review route is missing its noindex/private metadata.');
        }
        const matches = [...html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)];
        if (matches.length !== 1) throw new Error('Approved mascot must occur exactly once per review page.');
        const image = Buffer.from(matches[0][1], 'base64');
        if (image.toString('base64') !== matches[0][1] ||
            sha256(image) !== expectedImageSha256) {
          throw new Error('Compiled page does not contain the approved mascot bytes.');
        }
      }
      totalBytes += bytes.length;
      fileRecords.push(Object.freeze({
        path, bytes: bytes.length, sha256: sha256(bytes)
      }));
    }
  }
  await traverse(base);
  const paths = new Set(fileRecords.map(file => file.path));
  if (REVIEW_ROUTES.some(path => !paths.has(path))) {
    throw new Error('Incomplete seven-route private laboratory review.');
  }
  fileRecords.sort((a, b) => a.path.localeCompare(b.path));
  return Object.freeze({
    schema: REVIEW_SCHEMA, scope: 'offline_private_review_only',
    pageCount: REVIEW_ROUTES.length,
    fileCount: fileRecords.length, staticBytes: totalBytes,
    approvedMascotSha256: expectedImageSha256,
    routes: REVIEW_ROUTES, files: Object.freeze(fileRecords),
    externalModelEnabled: false, checkoutEnabled: false,
    productionPublished: false, operationalEffects: false
  });
}

export async function buildPrivateReviewBundle() {
  if (process.env.IMAGINE_FAISCA_LAB !== '1') {
    throw new Error('Review artifact requires IMAGINE_FAISCA_LAB=1.');
  }
  const originalManifest = JSON.parse(await readFile(resolve(projectRoot, 'asset-manifest.json'), 'utf8'));
  const preview = await auditFaiscaLabBuild({
    root: resolve(outputRoot, 'astro'), expectedImageSha256: originalManifest.sha256
  });
  const standalonePath = resolve(outputRoot, 'Faisca_Demonstracao_Guiada.html');
  const standalone = await buildDemo({ out: standalonePath });
  if (standalone.image_sha256 !== preview.approvedMascotSha256) {
    throw new Error('Standalone and private-preview mascots disagree.');
  }
  const result = Object.freeze({
    ...preview,
    standalone: Object.freeze({
      filename: 'Faisca_Demonstracao_Guiada.html',
      bytes: standalone.bytes, sha256: standalone.sha256,
      capabilities: 'R02 guided local demo only; R08-R20 require the separate laboratory'
    })
  });
  const readme = [
    'FAÍSCA — PACOTE DE REVISÃO LOCAL / SEM PUBLICAÇÃO',
    '',
    '1. Faisca_Demonstracao_Guiada.html funciona offline no navegador.',
    '   Inclui apenas a demonstração guiada (R02), NÃO o fluxo R20/PHP.',
    '2. O diretório astro/ contém 7 páginas de laboratório, todas NOINDEX.',
    '   Para testar a jornada R08/R20 completa é necessário o servidor',
    '   loopback Node + ponte PHP Agents pinada, conforme',
    '   docs/faisca/R20-COMPARACAO-COM-FONTES.md do repositório.',
    '3. NÃO publicar a pasta astro/ em host público ou CDN.',
    '4. Nenhum pedido, lead, cobrança ou atendimento humano é criado.',
    '5. Faisca_R21_AUDIT.json contém hashes SHA-256 para verificação.',
    '',
    'Este ZIP do GitHub Actions é somente evidência de laboratório.',
    ''
  ].join('\n');
  await mkdir(outputRoot, { recursive: true });
  await writeFile(resolve(outputRoot, 'Faisca_R21_AUDIT.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  await writeFile(resolve(outputRoot, 'LEIA-ME-FAISCA-R21.txt'), readme, { mode: 0o600 });
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--private-review') {
    throw new Error('Usage: node ops/faisca/review/build-review.mjs --private-review');
  }
  const review = await buildPrivateReviewBundle();
  process.stdout.write(JSON.stringify({
    schema: review.schema,
    scope: review.scope,
    pageCount: review.pageCount,
    fileCount: review.fileCount,
    staticBytes: review.staticBytes,
    approvedMascotSha256: review.approvedMascotSha256,
    standaloneSha256: review.standalone.sha256,
    productionPublished: false
  }) + '\n');
}
