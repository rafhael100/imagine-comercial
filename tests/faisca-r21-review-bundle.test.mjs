import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  auditFaiscaLabBuild, REVIEW_SCHEMA, REVIEW_ROUTES
} from '../ops/faisca/review/build-review.mjs';

const digest = data => createHash('sha256').update(data).digest('hex');
const image = Buffer.from('R21 synthetic approved mascot bytes', 'utf8');
const approval = digest(image);
const page = imageData => '<!doctype html><html lang="pt-BR"><head>' +
  '<meta name="robots" content="noindex,nofollow,noarchive">' +
  '<meta name="referrer" content="no-referrer"></head><body>' +
  '<img alt="Mascote Faísca" src="data:image/png;base64,' + imageData.toString('base64') + '">' +
  '</body></html>';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r21-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of REVIEW_ROUTES) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), page(image));
  }
  await mkdir(join(root, '_astro'));
  await writeFile(join(root, '_astro', 'app.HASH.js'), 'window.__labFixture=true;', 'utf8');
  return root;
}

test('R21 audits seven isolated noindex routes, exact mascot and static assets', async t => {
  const root = await fixture(t);
  const report = await auditFaiscaLabBuild({ root, expectedImageSha256: approval });
  assert.equal(report.schema, REVIEW_SCHEMA);
  assert.equal(report.scope, 'offline_private_review_only');
  assert.equal(report.pageCount, 7);
  assert.equal(report.fileCount, 8);
  assert.ok(report.staticBytes > 0);
  assert.deepEqual(report.routes, REVIEW_ROUTES);
  assert.equal(report.approvedMascotSha256, approval);
  assert.equal(report.productionPublished, false);
  assert.equal(report.checkoutEnabled, false);
  assert.equal(report.externalModelEnabled, false);
  assert.equal(report.operationalEffects, false);
  assert.equal(Object.isFrozen(report), true);
  assert.ok(report.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.ok(report.files.every(file => !Object.hasOwn(file, 'content')));
  assert.equal(JSON.stringify(report).includes('Mascote Faísca'), false);
});

test('R21 fails closed when a page is missing, indexed or carries altered artwork', async t => {
  const root = await fixture(t);
  await rm(join(root, 'support', 'index.html'));
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: approval }), /Incomplete seven-route/);

  await writeFile(join(root, 'support', 'index.html'),
    page(image).replace('noindex,nofollow,noarchive', 'index,follow'));
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: approval }), /noindex\/private/);

  await writeFile(join(root, 'support', 'index.html'), page(Buffer.from('unapproved synthetic bytes')));
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: approval }), /approved mascot bytes/);
});

test('R21 refuses unreviewed files, nested trees and symlinked assets', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'secrets.txt'), 'never package unreviewed files');
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: approval }), /Unreviewed file/);
  await rm(join(root, 'secrets.txt'));

  await mkdir(join(root, 'extra'));
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: approval }), /Unreviewed directory/);
  await rm(join(root, 'extra'), { recursive: true });

  await symlink(join(root, '_astro', 'app.HASH.js'), join(root, '_astro', 'alias.js'));
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: approval }), /Symlink/);
});

test('R21 validates approved image fingerprint input and rejects a symlink root', async t => {
  const root = await fixture(t);
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: 'bad' }), TypeError);
  await assert.rejects(auditFaiscaLabBuild({ root, expectedImageSha256: digest('different') }), /approved mascot bytes/);
  const link = root + '-shortcut';
  t.after(() => rm(link, { force: true }));
  await symlink(root, link, 'dir');
  await assert.rejects(auditFaiscaLabBuild({ root: link, expectedImageSha256: approval }), /non-symlinked directory/);
});
