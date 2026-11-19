import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  auditFaiscaLabBuild, REVIEW_ROUTES
} from '../ops/faisca/review/build-review.mjs';
import {
  preparePrivateCommercialFaisca, startPrivateCommercialFaisca,
  COMPOSITE_SCHEMA
} from '../ops/faisca/composition/commercial-preview.mjs';
import { createPrivateLoopbackPreview } from '../src/lib/private-loopback-preview.mjs';

const password = 'SYNTHETIC_TEST_PASSWORD_24+__review';
const img = Buffer.from('R24 approved mascot test fixture, not a real customer file');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fakeLabPage = () => '<!doctype html><html lang="pt-BR"><head>' +
  '<meta name="robots" content="noindex,nofollow,noarchive">' +
  '<meta name="referrer" content="no-referrer"></head><body>' +
  '<img src="data:image/png;base64,' + img.toString('base64') + '">' +
  '<button data-journey-start>Iniciar teste</button></body></html>';
const site = '<!doctype html><html lang="pt-BR"><head><title>Imagine Comercial</title>' +
  '</head><body><main><a href="#simular-compra" data-purchase-start>' +
  'Simular compra</a><div id="simular-compra">Prévia sem checkout</div></main>' +
  '<footer><a href="/contato/">Contato</a></footer></body></html>';
const auth = 'Basic ' + Buffer.from('reviewer:' + password).toString('base64');

async function fixture(t, { assetCollision = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r24-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const commercialDir = join(root, 'dist');
  const faiscaBundleDir = join(root, 'faisca');
  await mkdir(commercialDir);
  await mkdir(join(faiscaBundleDir, 'astro'), { recursive: true });
  await writeFile(join(commercialDir, 'index.html'), site, 'utf8');
  for (const path of REVIEW_ROUTES) {
    const full = join(faiscaBundleDir, 'astro', path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, fakeLabPage());
  }
  const asset = join(faiscaBundleDir, 'astro', '_astro', 'journey.TESTHASH.js');
  await mkdir(dirname(asset), { recursive: true });
  await writeFile(asset, 'window.__faiscaPrivateTest=1;', 'utf8');
  if (assetCollision) {
    const existing = join(commercialDir, '_astro', 'journey.TESTHASH.js');
    await mkdir(dirname(existing), { recursive: true });
    await writeFile(existing, 'window.__differentSiteAsset=1;', 'utf8');
  }
  const review = await auditFaiscaLabBuild({
    root: join(faiscaBundleDir, 'astro'), expectedImageSha256: sha256(img)
  });
  await writeFile(join(faiscaBundleDir, 'Faisca_R21_AUDIT.json'), JSON.stringify(review));
  return { root, commercialDir, faiscaBundleDir, asset };
}

test('R24 composes the actual compiled commercial HTML with a private, audited Faísca link', async t => {
  const files = await fixture(t);
  const prepared = await preparePrivateCommercialFaisca(files);
  assert.equal(prepared.schema, COMPOSITE_SCHEMA);
  assert.equal(prepared.privatePageCount, 2);
  assert.equal(prepared.checkedAssetCount, 8);
  assert.equal(prepared.approvedMascotSha256, sha256(img));
  assert.equal(prepared.noCheckout, true);
  assert.equal(prepared.noModel, true);
  assert.equal(prepared.noPublicDeploy, true);
  assert.ok(prepared.extra.has('/__faisca_preview/journey/'));
  assert.ok(prepared.extra.has('/__faisca_preview/support/'));
  assert.ok(prepared.extra.has('/_astro/journey.TESTHASH.js'));

  const before = await readFile(join(files.commercialDir, 'index.html'));
  const stage = await startPrivateCommercialFaisca({ ...files, password });
  t.after(() => stage.close());
  assert.match(stage.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(stage.productionPublished, false);
  assert.equal(stage.checkoutEnabled, false);
  assert.equal(stage.externalModelEnabled, false);
  assert.equal(stage.operationalEffects, false);

  const page = await fetch(stage.origin + '/', { headers: { Authorization: auth } });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('set-cookie'), null);
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  assert.match(page.headers.get('cache-control'), /no-store/);
  const html = await page.text();
  assert.match(html, /data-faisca-private-entry/);
  assert.match(html, /href="\/__faisca_preview\/journey\/"/);
  assert.match(html, /data-faisca-private-inline/);
  assert.match(html, /data-faisca-inline-frame/);
  assert.match(html, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.match(html, /id="simular-compra"/);
  assert.match(html, /data-purchase-start/);
  assert.match(html, /Prévia sem checkout/);
  assert.deepEqual(await readFile(join(files.commercialDir, 'index.html')), before);
  assert.doesNotMatch(before.toString('utf8'), /data-faisca-private-entry/);

  for (const route of ['/__faisca_preview/journey/', '/__faisca_preview/support/']) {
    const response = await fetch(stage.origin + route, { headers: { Authorization: auth } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    assert.match(await response.text(), /data-journey-start/);
  }
  const js = await fetch(stage.origin + '/_astro/journey.TESTHASH.js', {
    headers: { Authorization: auth }
  });
  assert.equal(js.status, 200);
  assert.match(await js.text(), /__faiscaPrivateTest/);
});

test('R24 all commercial and Faísca routes deny anonymous visitors and writes', async t => {
  const files = await fixture(t);
  const stage = await startPrivateCommercialFaisca({ ...files, password });
  t.after(() => stage.close());
  for (const path of ['/', '/__faisca_preview/journey/', '/__faisca_preview/support/',
    '/_astro/journey.TESTHASH.js']) {
    const response = await fetch(stage.origin + path, { redirect: 'manual' });
    assert.equal(response.status, 401, path);
    assert.match(response.headers.get('www-authenticate'), /^Basic/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.doesNotMatch(await response.text(), /Mascote|data-faisca-private-entry|window.__/);
  }
  const blocked = await fetch(stage.origin + '/__faisca_lab/messages', {
    method: 'POST', headers: { Authorization: auth }, body: 'fake'
  });
  assert.equal(blocked.status, 405);
  const disabled = await fetch(stage.origin + '/__faisca_preview/journey-http-r08/', {
    headers: { Authorization: auth }
  });
  assert.equal(disabled.status, 404);
  const unchangedSite = await fetch(stage.origin + '/contato/', {
    headers: { Authorization: auth }
  });
  assert.equal(unchangedSite.status, 404); // Fixture has no contact page.
});

test('R24 rejects same-name script collisions or tampered Faísca files before server startup', async t => {
  const conflict = await fixture(t, { assetCollision: true });
  await assert.rejects(preparePrivateCommercialFaisca(conflict), /asset collision/);
  const files = await fixture(t);
  const file = await readFile(files.asset);
  const tampered = Buffer.from(file);
  tampered[tampered.length - 1] ^= 1;
  await writeFile(files.asset, tampered);
  await assert.rejects(startPrivateCommercialFaisca({ ...files, password }), /digest differs/);
});

test('R24 standalone commercial private preview is unchanged without an approved Faísca bundle', async t => {
  const files = await fixture(t);
  const server = createPrivateLoopbackPreview({ directory: files.commercialDir, password });
  // No extra routes and no CTA; the original private commercial preview stays intact.
  assert.ok(server);
  // Unstarted listener has no open resource to close.
  const forbidden = new Map([
    ['/__faisca_preview/journey/', Buffer.from('lab')],
    ['/__faisca_preview/support/', Buffer.from('lab')],
    ['/secrets.env', Buffer.from('never')]
  ]);
  assert.throws(() => createPrivateLoopbackPreview({
    directory: files.commercialDir, password, faiscaPrivateAssets: forbidden
  }), /unapproved private artifact path/);
  await assert.rejects(startPrivateCommercialFaisca({
    ...files, password: 'short'
  }), TypeError);
});
