/**
 * F22: somente lê dist e produz artefato REVIEW-ONLY fora do diretório publicável.
 * NÃO copia arquivos de site nem cria token, assinatura ou script de deploy.
 */
import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises';
import {join, posix} from 'node:path';
import {createReleaseReview, verifyReleaseReview} from '../src/lib/release-review.mjs';

const dist = 'dist';
const output = 'artifacts/release-review';

async function readTree(relative = '') {
  const items = await readdir(join(dist, relative), {withFileTypes: true});
  const all = [];
  for (const item of items) {
    const next = relative ? posix.join(relative, item.name) : item.name;
    if (item.isSymbolicLink()) throw new Error('review: symlinks are forbidden: ' + next);
    if (item.isDirectory()) {
      all.push(...await readTree(next));
    } else if (item.isFile()) {
      all.push({path: next, bytes: await readFile(join(dist, next))});
    } else {
      throw new Error('review: unsupported filesystem entry: ' + next);
    }
  }
  return all;
}

const files = await readTree();
const report = createReleaseReview(files);
verifyReleaseReview(files, report);
await mkdir(output, {recursive: true});
const path = join(output, 'REVIEW-ONLY-static-build-sha256.json');
await writeFile(path, JSON.stringify(report, null, 2) + '\n', {flag: 'w'});
const summary = [
  'IMAGINE COMERCIAL: BUILD INVENTORY FOR REVIEW ONLY',
  'NOT A DEPLOYMENT AUTHORIZATION; NOT A SIGNED ATTESTATION',
  'Files: ' + report.fileCount,
  'Public HTML pages: ' + report.htmlPages,
  'Total bytes: ' + report.totalBytes,
  'Tree SHA-256: ' + report.treeSha256,
  'No deployment was performed.'
].join('\n') + '\n';
await writeFile(join(output, 'REVIEW-ONLY-summary.txt'), summary, {flag: 'w'});
console.log(summary);
