import { createHash } from 'node:crypto';
import { lstat, realpath, readdir, readFile, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const STAGING_KIT_SCHEMA = 'faisca.static-private-staging-kit.v1';
const MAX_MANIFEST_BYTES = 128 * 1024;
const MAX_FILES = 390;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 180 * 1024 * 1024;
const sha = data => createHash('sha256').update(data).digest('hex');
const CORE_FILES = Object.freeze([
  'site/index.html', 'site/404.html', 'site/robots.txt', 'site/sitemap.xml',
  'site/__faisca_preview/journey/index.html',
  'site/__faisca_preview/support/index.html',
  'site/__faisca_preview/quote-bridge.js',
  'ops/staging/compose.yaml', 'ops/staging/nginx.conf', 'verify-kit.mjs',
  'LEIA-ME-FAISCA-R38.txt'
]);

function isSafePath(path) {
  return typeof path === 'string' && path.length <= 300 &&
    /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(path) &&
    !path.split('/').some(part => part === '.' || part === '..') &&
    (path.startsWith('site/') ||
      ['ops/staging/compose.yaml','ops/staging/nginx.conf',
       'verify-kit.mjs','LEIA-ME-FAISCA-R38.txt'].includes(path));
}

async function walkFiles(root) {
  const files = [];
  let totalBytes = 0;
  async function walk(folder) {
    for (const dirent of await readdir(folder, { withFileTypes: true })) {
      if (dirent.isSymbolicLink()) throw new Error('R38: symlink forbidden in review kit.');
      const full = resolve(folder, dirent.name);
      const path = relative(root, full).split(sep).join('/');
      if (dirent.isDirectory()) { await walk(full); continue; }
      if (path === 'Faisca_R38_MANIFEST.json') continue;
      if (!dirent.isFile() || !isSafePath(path) || files.length >= MAX_FILES) {
        throw new Error('R38: unexpected file in review kit.');
      }
      const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_FILE_BYTES ||
            totalBytes + stat.size > MAX_TOTAL_BYTES) {
          throw new Error('R38: review kit byte limit exceeded.');
        }
        bytes = await handle.readFile();
      } finally { await handle.close(); }
      totalBytes += bytes.length;
      files.push(Object.freeze({ path, bytes: bytes.length, sha256: sha(bytes) }));
    }
  }
  await walk(root);
  files.sort((a,b) => a.path.localeCompare(b.path,'en'));
  return Object.freeze({ files: Object.freeze(files), totalBytes });
}

/** Snapshot builder and verifier share the exact same bounded walk. */
export async function snapshotPrivateStagingFiles({ kitDir } = {}) {
  if (typeof kitDir !== 'string') throw new TypeError('R38: kit directory required.');
  const root = resolve(kitDir);
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) {
    throw new Error('R38: kit directory must not be a symlink.');
  }
  return walkFiles(root);
}

// R230: the manifest is untrusted input. The former unbounded readFile()
// could allocate arbitrary memory before the kit size limits even ran.
// Refuse symlinks, FIFOs, multi-linked files, oversized or changing manifests
// and malformed UTF-8 before parsing. This does NOT attest the publisher.
async function readBoundedManifest(root) {
  let handle;
  try {
    handle = await open(resolve(root, 'Faisca_R38_MANIFEST.json'),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n ||
        before.size < 64n || before.size > BigInt(MAX_MANIFEST_BYTES)) {
      throw new Error('R230: invalid private kit manifest type or size.');
    }
    const buffer = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) throw new Error('R230: truncated private kit manifest.');
      offset += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs']
      .some(key => before[key] !== after[key])) {
      throw new Error('R230: private kit manifest changed during read.');
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
  } finally {
    await handle?.close();
  }
}

/** Caller must independently verify the GitHub Actions source SHA. This
 * manifest is an integrity checklist, NOT a signed deployment credential.
 */
export async function verifyPrivateStagingKit({ kitDir } = {}) {
  if (typeof kitDir !== 'string') throw new TypeError('R38: kit directory required.');
  const root = resolve(kitDir);
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) {
    throw new Error('R38: kit directory must not be a symlink.');
  }
  const manifest = await readBoundedManifest(root);
  if (!manifest || manifest.schema !== STAGING_KIT_SCHEMA ||
      manifest.status !== 'REVIEW_ONLY_NO_DEPLOY' ||
      manifest.publicFaiscaEnabled !== false ||
      manifest.productionPublished !== false ||
      manifest.checkoutEnabled !== false || manifest.externalModelEnabled !== false ||
      manifest.operationalEffects !== false ||
      !Number.isInteger(manifest.fileCount) || manifest.fileCount > MAX_FILES ||
      !Number.isInteger(manifest.totalBytes) || manifest.totalBytes > MAX_TOTAL_BYTES ||
      !Array.isArray(manifest.files) || manifest.files.length !== manifest.fileCount ||
      !/^[0-9a-f]{64}$/.test(manifest.approvedMascotSha256)) {
    throw new Error('R38: private review kit manifest invalid.');
  }
  const actual = await walkFiles(root);
  if (actual.files.length !== manifest.fileCount || actual.totalBytes !== manifest.totalBytes ||
      JSON.stringify(actual.files) !== JSON.stringify(manifest.files) ||
      CORE_FILES.some(path => !actual.files.some(f => f.path === path))) {
    throw new Error('R38: private staging kit content differs from its manifest.');
  }
  const [nginx, compose, home] = await Promise.all([
    readFile(resolve(root,'ops/staging/nginx.conf'),'utf8'),
    readFile(resolve(root,'ops/staging/compose.yaml'),'utf8'),
    readFile(resolve(root,'site/index.html'),'utf8')
  ]);
  const configMarkers = [
    'map $request_uri $faisca_review_frame {',
    'map $request_uri $faisca_review_ancestors {',
    'include /etc/nginx/mime.types;',
    'default_type application/octet-stream;',
    'auth_basic_user_file /etc/nginx/auth/.htpasswd;',
    'X-Robots-Tag "noindex, nofollow, noarchive"',
    'connect-src \'none\'', 'form-action \'none\'',
    'limit_except GET HEAD { deny all; }'
  ];
  const composeMarkers = [
    '127.0.0.1:4337:8080','IMAGINE_FAISCA_NGINX_IMAGE',
    'IMAGINE_FAISCA_STAGING_HTPASSWD_PATH',
    'no-new-privileges:true','read_only: true'
  ];
  // A rehashed manifest is not permission to turn the staging perimeter off.
  // Substring markers alone can survive inside comments or alongside a later
  // auth/header override. Require the reviewed active directives and refuse
  // known Nginx authentication bypasses even in an internally consistent kit.
  // This check complements, but NEVER replaces, independent source-SHA review
  // and an operator's nginx -T / HTTP 401 inspection before any staging use.
  const activeLines = nginx.split(/\r?\n/).map(line =>
    line.replace(/#.*$/, '').trim()).filter(Boolean);
  const active = new Set(activeLines);
  const requiredActive = [
    'map $request_uri $faisca_review_frame {',
    'map $request_uri $faisca_review_ancestors {',
    'include /etc/nginx/mime.types;',
    'default_type application/octet-stream;',
    'auth_basic "Imagine Faísca private review";',
    'auth_basic_user_file /etc/nginx/auth/.htpasswd;',
    'limit_except GET HEAD { deny all; }'
  ];
  const requiredHeaders = [
    'add_header Cache-Control "private, no-store, max-age=0" always;',
    'add_header X-Robots-Tag "noindex, nofollow, noarchive" always;',
    'add_header X-Content-Type-Options "nosniff" always;',
    'add_header Referrer-Policy "no-referrer" always;',
    'add_header X-Frame-Options $faisca_review_frame always;',
    'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
    'add_header Content-Security-Policy "default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'none\'; font-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-src \'self\'; frame-ancestors $faisca_review_ancestors" always;'
  ];
  const actualHeaders = activeLines.filter(line => /^add_header\s/.test(line));
  const authLines = activeLines.filter(line => /^auth_basic\s/.test(line));
  const authFileLines = activeLines.filter(line => /^auth_basic_user_file\s/.test(line));
  const activeConfig = activeLines.join('\n');
  // R229: the previous same-length + allowlist check accepted a duplicate
  // permitted header in place of a mandatory one (e.g. missing CSP with a
  // second Cache-Control). Every reviewed header must occur EXACTLY once.
  // Do not count directives preserved as comments or accept extra auth files.
  if (requiredActive.some(line => !active.has(line)) ||
      actualHeaders.length !== requiredHeaders.length ||
      requiredHeaders.some(line => actualHeaders.filter(actual => actual === line).length !== 1) ||
      authLines.length !== 1 || authLines[0] !== requiredActive[4] ||
      authFileLines.length !== 1 || authFileLines[0] !== requiredActive[5] ||
      /\bauth_basic\s+off\s*;|\bsatisfy\s+any\s*;|\ballow\s+all\s*;/i.test(activeConfig)) {
    throw new Error('R38: review kit lost its private staging protections.');
  }

  // The original request URI must survive Nginx try_files index redirects.
  // Never admit the old $uri mapping, even if an attacker regenerates hashes.
  if (nginx.includes('map $uri $faisca_review_') ||
      configMarkers.some(marker => !nginx.includes(marker)) ||
      composeMarkers.some(marker => !compose.includes(marker)) ||
      !home.includes('data-faisca-private-entry') ||
      !home.includes('data-faisca-apply-choice') ||
      !home.includes('/__faisca_preview/quote-bridge.js')) {
    throw new Error('R38: review kit lost its private staging protections.');
  }
  return Object.freeze({
    schema: STAGING_KIT_SCHEMA, filesChecked: actual.files.length,
    bytesChecked: actual.totalBytes, approvedMascotSha256: manifest.approvedMascotSha256,
    deployPerformed: false, operationalEffects: false
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
    throw new Error('Usage: node verify-kit.mjs --verify');
  }
  const report = await verifyPrivateStagingKit({
    kitDir: dirname(fileURLToPath(import.meta.url))
  });
  process.stdout.write(JSON.stringify(report) + '\n');
}
