import { createHash } from 'node:crypto';
import { readdir, readFile, realpath, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

export const PORTABLE_DIST_SCHEMA = 'faisca.portable-public-dist-sha256.v1';
const MAX_FILES = 350;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 160 * 1024 * 1024;
const sha256 = data => createHash('sha256').update(data).digest('hex');

function safePath(path) {
  return typeof path === 'string' && path.length <= 300 &&
    /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(path) &&
    !path.split('/').some(part => part === '.' || part === '..');
}

async function realDirectory(path) {
  const root = resolve(path);
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) {
    throw new Error('R29: only an actual, non-symlinked public-dist directory is allowed.');
  }
  return root;
}

export async function snapshotPortablePublicDist({ directory } = {}) {
  if (typeof directory !== 'string') throw new TypeError('R29: directory required.');
  const root = await realDirectory(directory);
  const files = [];
  let totalBytes = 0;
  async function walk(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (!safePath(path) || entry.isSymbolicLink()) {
        throw new Error('R29: an invalid path or symlink was detected.');
      }
      if (entry.isDirectory()) {
        await walk(resolve(folder, entry.name), path + '/');
        continue;
      }
      if (!entry.isFile() || files.length >= MAX_FILES) {
        throw new Error('R29: unexpected file or exceeded file-count cap.');
      }
      const handle = await open(resolve(folder, entry.name), constants.O_RDONLY | constants.O_NOFOLLOW);
      let data;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_FILE_BYTES ||
            totalBytes + stat.size > MAX_TOTAL_BYTES) {
          throw new Error('R29: size cap exceeded or file invalid.');
        }
        data = await handle.readFile();
        if (data.length !== stat.size) throw new Error('R29: public file changed during audit.');
      } finally { await handle.close(); }
      files.push(Object.freeze({ path, bytes: data.length, sha256: sha256(data) }));
      totalBytes += data.length;
    }
  }
  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const paths = new Set(files.map(item => item.path));
  if (!paths.has('index.html') || !paths.has('404.html') ||
      !paths.has('robots.txt') || !paths.has('sitemap.xml')) {
    throw new Error('R29: incomplete public Comercial dist.');
  }
  return Object.freeze({
    schema: PORTABLE_DIST_SCHEMA, scope: 'commercial_dist_private_review_only',
    files: Object.freeze(files), fileCount: files.length, bytes: totalBytes,
    publicFaiscaEnabled: false, operationalEffects: false, productionPublished: false
  });
}

/** One extra integrity check on extracted ZIP files, prior to opening any
 * local port. The manifest is reproducible but not a cryptographic signature:
 * independently verify the GitHub run/SHA when authenticity matters.
 */
export async function verifyPortablePublicDist({ directory, manifestPath } = {}) {
  if (typeof manifestPath !== 'string') throw new TypeError('R29: manifest path required.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest || manifest.schema !== PORTABLE_DIST_SCHEMA ||
      manifest.scope !== 'commercial_dist_private_review_only' ||
      manifest.publicFaiscaEnabled !== false ||
      manifest.operationalEffects !== false || manifest.productionPublished !== false ||
      !Array.isArray(manifest.files) ||
      !Number.isInteger(manifest.fileCount) || manifest.fileCount > MAX_FILES ||
      manifest.fileCount !== manifest.files.length ||
      !Number.isInteger(manifest.bytes) || manifest.bytes > MAX_TOTAL_BYTES) {
    throw new Error('R29: private review manifest is invalid.');
  }
  const observed = await snapshotPortablePublicDist({ directory });
  if (JSON.stringify(observed) !== JSON.stringify(manifest)) {
    throw new Error('R29: compiled Comercial dist differs from the approved review snapshot.');
  }
  return observed;
}
