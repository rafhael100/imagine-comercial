import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, cp, rm, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  STAGING_KIT_SCHEMA, snapshotPrivateStagingFiles, verifyPrivateStagingKit
} from '../ops/faisca/staging/verify-kit.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r38-kit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const items = new Map([
    ['site/index.html', '<!doctype html><html><main><section data-faisca-private-entry><button data-faisca-apply-choice>Escolher</button><script src="/__faisca_preview/quote-bridge.js"></script></section></main></html>'],
    ['site/404.html', '<!doctype html><html><title>404</title></html>'],
    ['site/robots.txt', 'User-agent: *\nDisallow: /\n'],
    ['site/sitemap.xml', '<?xml version="1.0"?><urlset/>'],
    ['site/__faisca_preview/journey/index.html', '<!doctype html><html><title>Jornada</title></html>'],
    ['site/__faisca_preview/support/index.html', '<!doctype html><html><title>Suporte</title></html>'],
    ['site/__faisca_preview/quote-bridge.js', 'const localOnly=true;'],
    ['LEIA-ME-FAISCA-R38.txt', 'PRIVATE REVIEW ONLY']
  ]);
  for (const [path,data] of items) {
    const target = join(dir,path);
    await mkdir(dirname(target), {recursive:true});
    await writeFile(target, data);
  }
  for (const [dest,from] of [
    ['ops/staging/nginx.conf','../ops/faisca/staging/nginx.conf'],
    ['ops/staging/compose.yaml','../ops/faisca/staging/compose.yaml'],
    ['verify-kit.mjs','../ops/faisca/staging/verify-kit.mjs']
  ]) {
    const to = join(dir,dest);
    await mkdir(dirname(to),{recursive:true});
    await cp(new URL(from, import.meta.url),to);
  }
  const snapshot = await snapshotPrivateStagingFiles({kitDir:dir});
  const manifest = {
    schema: STAGING_KIT_SCHEMA, status: 'REVIEW_ONLY_NO_DEPLOY',
    approvedMascotSha256: '1'.repeat(64),
    publicFaiscaEnabled: false, productionPublished: false,
    checkoutEnabled: false, externalModelEnabled: false, operationalEffects: false,
    fileCount: snapshot.files.length, totalBytes: snapshot.totalBytes, files: snapshot.files
  };
  const manifestFile = join(dir,'Faisca_R38_MANIFEST.json');
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  return {dir,manifestFile};
}

test('R38 reviews a closed private static staging tree and returns no release authority', async t => {
  const {dir}=await fixture(t);
  const result = await verifyPrivateStagingKit({kitDir:dir});
  assert.equal(result.schema, STAGING_KIT_SCHEMA);
  assert.equal(result.deployPerformed, false);
  assert.equal(result.operationalEffects, false);
  assert.ok(result.filesChecked >= 11);
  assert.equal(result.approvedMascotSha256, '1'.repeat(64));
  assert.ok(Object.isFrozen(result));
});

test('R38 refuses a modified script even with unchanged number of bytes', async t => {
  const {dir}=await fixture(t);
  const path=join(dir,'site/__faisca_preview/quote-bridge.js');
  const b=Buffer.from(await readFile(path));
  b[0]^=1;
  await writeFile(path,b);
  await assert.rejects(verifyPrivateStagingKit({kitDir:dir}), /content differs/);
});

test('R38 detects extra files, missing private route, and a symlinked source', async t => {
  const {dir}=await fixture(t);
  await writeFile(join(dir,'site/random.txt'),'unreviewed');
  await assert.rejects(verifyPrivateStagingKit({kitDir:dir}), /content differs/);
  await rm(join(dir,'site/random.txt'));
  await rm(join(dir,'site/__faisca_preview/support/index.html'));
  await assert.rejects(verifyPrivateStagingKit({kitDir:dir}), /content differs/);
  const link = dir + '-symlink';
  t.after(() => rm(link,{force:true}));
  await symlink(dir, link, 'dir');
  await assert.rejects(verifyPrivateStagingKit({kitDir:link}), /must not be a symlink/);
});

test('R38 corrupted or permissive manifests refuse to claim a private review', async t => {
  const {dir,manifestFile}=await fixture(t);
  const old = JSON.parse(await readFile(manifestFile,'utf8'));
  old.productionPublished=true;
  await writeFile(manifestFile,JSON.stringify(old));
  await assert.rejects(verifyPrivateStagingKit({kitDir:dir}), /manifest invalid/);
});

test('R38 a changed Nginx auth policy invalidates manifest and cannot pass review', async t => {
  const {dir,manifestFile}=await fixture(t);
  const nginx=join(dir,'ops/staging/nginx.conf');
  const text=await readFile(nginx,'utf8');
  await writeFile(nginx,text.replace('auth_basic_user_file /etc/nginx/auth/.htpasswd;',
    'auth_basic off;'));
  await assert.rejects(verifyPrivateStagingKit({kitDir:dir}), /content differs/);
  const m=JSON.parse(await readFile(manifestFile,'utf8'));
  assert.equal(m.status,'REVIEW_ONLY_NO_DEPLOY');
  assert.equal(m.checkoutEnabled,false);
  assert.equal(m.externalModelEnabled,false);
  assert.ok(!JSON.stringify(m).includes('SYNTHETIC_TEST_PASSWORD'));
});


test('R41 rejects an apparently valid rehashed kit that regresses to $uri frame maps', async t => {
  const {dir,manifestFile}=await fixture(t);
  const path=join(dir,'ops/staging/nginx.conf');
  const current=await readFile(path,'utf8');
  assert.equal(current.split('map $request_uri $faisca_review_').length-1,2);
  const unsafe=current.replaceAll('map $request_uri $faisca_review_','map $uri $faisca_review_');
  await writeFile(path,unsafe);
  // Simulate a rewritten self-contained manifest: hashes alone are not policy.
  const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
  const record=manifest.files.find(file=>file.path==='ops/staging/nginx.conf');
  assert.ok(record);
  record.bytes=Buffer.byteLength(unsafe);
  record.sha256=createHash('sha256').update(unsafe).digest('hex');
  manifest.totalBytes=manifest.files.reduce((sum,file)=>sum+file.bytes,0);
  await writeFile(manifestFile,JSON.stringify(manifest));
  await assert.rejects(verifyPrivateStagingKit({kitDir:dir}),
    /lost its private staging protections/);
});


test('R44 a rehashed Nginx kit still cannot omit the reviewed MIME registry',async t=>{
  const {dir,manifestFile}=await fixture(t);
  const nginxFile=join(dir,'ops/staging/nginx.conf');
  const original=await readFile(nginxFile,'utf8');
  assert.match(original,/include \/etc\/nginx\/mime\.types;/);
  assert.match(original,/default_type application\/octet-stream;/);
  const tampered=original.replace('include /etc/nginx/mime.types;','');
  await writeFile(nginxFile,tampered);
  const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
  const entry=manifest.files.find(x=>x.path==='ops/staging/nginx.conf');
  assert.ok(entry);
  entry.bytes=Buffer.byteLength(tampered);
  entry.sha256=createHash('sha256').update(tampered).digest('hex');
  manifest.totalBytes=manifest.files.reduce((sum,x)=>sum+x.bytes,0);
  await writeFile(manifestFile,JSON.stringify(manifest));
  await assert.rejects(verifyPrivateStagingKit({kitDir:dir}),
    /lost its private staging protections/);
});


async function rehashNginxFixture(dir, manifestFile, changed) {
  const nginxFile = join(dir, 'ops/staging/nginx.conf');
  await writeFile(nginxFile, changed);
  // Simulate tampering with both the file AND its self-contained manifest.
  // The verification must inspect policy, not trust self-reported hashes.
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const entry = manifest.files.find(item => item.path === 'ops/staging/nginx.conf');
  assert.ok(entry);
  entry.bytes = Buffer.byteLength(changed, 'utf8');
  entry.sha256 = createHash('sha256').update(changed).digest('hex');
  manifest.totalBytes = manifest.files.reduce((sum, item) => sum + item.bytes, 0);
  await writeFile(manifestFile, JSON.stringify(manifest));
}

test('R65: rehashed staging with auth_basic off fails despite an untouched htpasswd marker', async t => {
  const { dir, manifestFile } = await fixture(t);
  const original = await readFile(join(dir, 'ops/staging/nginx.conf'), 'utf8');
  const changed = original.replace('auth_basic "Imagine Faísca private review";', 'auth_basic off;');
  assert.notEqual(changed, original);
  assert.match(changed, /auth_basic_user_file \/etc\/nginx\/auth\/\.htpasswd;/);
  await rehashNginxFixture(dir, manifestFile, changed);
  await assert.rejects(verifyPrivateStagingKit({ kitDir: dir }), /lost its private staging protections/);
});

test('R65: policy marker inside a comment cannot satisfy active staging authentication', async t => {
  const { dir, manifestFile } = await fixture(t);
  const original = await readFile(join(dir, 'ops/staging/nginx.conf'), 'utf8');
  const changed = original.replace('auth_basic_user_file /etc/nginx/auth/.htpasswd;',
    '# auth_basic_user_file /etc/nginx/auth/.htpasswd;');
  assert.notEqual(changed, original);
  await rehashNginxFixture(dir, manifestFile, changed);
  await assert.rejects(verifyPrivateStagingKit({ kitDir: dir }), /lost its private staging protections/);
});

test('R65: rehashed extra response header and disabled method restriction are rejected', async t => {
  for (const mutation of [
    source => source.replace('limit_except GET HEAD { deny all; }',
      '# limit_except GET HEAD { deny all; }'),
    source => source.replace('limit_except GET HEAD { deny all; }',
      'add_header X-Robots-Tag "index, follow" always;\n        limit_except GET HEAD { deny all; }'),
    source => source.replace('limit_except GET HEAD { deny all; }',
      'satisfy any; allow all; limit_except GET HEAD { deny all; }')
  ]) {
    const { dir, manifestFile } = await fixture(t);
    const original = await readFile(join(dir, 'ops/staging/nginx.conf'), 'utf8');
    const changed = mutation(original);
    assert.notEqual(changed, original);
    await rehashNginxFixture(dir, manifestFile, changed);
    await assert.rejects(verifyPrivateStagingKit({ kitDir: dir }), /lost its private staging protections/);
  }
});


test('R229 blocks rehashed Nginx kit when duplicate Cache-Control disguises missing active CSP', async t => {
  const { dir, manifestFile } = await fixture(t);
  const original = await readFile(join(dir, 'ops/staging/nginx.conf'), 'utf8');
  const cspLine = original.split(/\r?\n/).find(line =>
    line.trim().startsWith('add_header Content-Security-Policy '));
  assert.ok(cspLine, 'reviewed CSP line must exist');
  // Keep the old literal marker in a COMMENT, which satisfies naive
  // substring searches. Duplicate a permitted header instead of active CSP:
  // the old same-length allowlist test incorrectly accepted this config.
  const replacement = '    add_header Cache-Control "private, no-store, max-age=0" always;\n' +
    '    # ' + cspLine.trim();
  const changed = original.replace(cspLine, replacement);
  assert.notEqual(changed, original);
  assert.equal(changed.split(/\r?\n/).filter(line =>
    line.trim().startsWith('add_header Content-Security-Policy ')).length, 0);
  await rehashNginxFixture(dir, manifestFile, changed);
  await assert.rejects(verifyPrivateStagingKit({ kitDir: dir }),
    /lost its private staging protections/);
});

test('R229 blocks rehashed staging with extra alternate auth_basic_user_file', async t => {
  const { dir, manifestFile } = await fixture(t);
  const original = await readFile(join(dir, 'ops/staging/nginx.conf'), 'utf8');
  const checked = 'auth_basic_user_file /etc/nginx/auth/.htpasswd;';
  const changed = original.replace(checked,
    checked + '\n    auth_basic_user_file /tmp/alternate-unaudited.htpasswd;');
  assert.notEqual(changed, original);
  await rehashNginxFixture(dir, manifestFile, changed);
  await assert.rejects(verifyPrivateStagingKit({ kitDir: dir }),
    /lost its private staging protections/);
});
