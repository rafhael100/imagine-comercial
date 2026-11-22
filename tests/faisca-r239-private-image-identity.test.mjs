import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { reviewFaiscaPrivateLocalImageIdentity as review }
  from '../ops/faisca/staging/review-image-identity.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = 'nginxinc/nginx-unprivileged@sha256:' + 'ab'.repeat(32);
const configId = 'sha256:' + 'cd'.repeat(32);
const fixture = () => ({
  container: { Image: configId, Config: { Image: manifest } },
  image: { Id: configId, RepoDigests: [manifest],
    Os: 'linux', Architecture: 'amd64' },
  expectedImage: manifest
});
function deny(mutator) {
  const input = fixture();
  mutator(input);
  assert.throws(() => review(input), /R239|F164/);
}

test('R239 binds immutable reference and local config identity without confusing digests', () => {
  const output = review(fixture());
  assert.equal(output.status, 'LOCAL_DOCKER_IMAGE_IDS_CORRELATED_REVIEW_ONLY');
  assert.equal(output.reportedManifestReferenceMatchesPin, true);
  assert.equal(output.reportedImageConfigIdMatchesDaemonMetadata, true);
  assert.equal(output.configDigestDistinctFromManifestDigest, true);
  assert.equal(output.registryManifestIndependentlyFetched, false);
  assert.equal(output.signatureAndSupplyChainProvenanceVerified, false);
  assert.equal(output.deploymentAuthorized, false);
  assert.equal(output.publicFaiscaEnabled, false);
  assert.ok(Object.isFrozen(output));
  assert.ok(!JSON.stringify(output).includes(configId));
  assert.ok(!JSON.stringify(output).includes(manifest));
  const arm64 = fixture();
  arm64.image.Architecture = 'arm64';
  assert.equal(review(arm64).deploymentAuthorized, false);
});

test('R239 rejects a different running image ID even when the manifest reference looks correct', () => {
  deny(x => { x.container.Image = 'sha256:'+'ef'.repeat(32); });
  deny(x => { x.image.Id = 'sha256:'+'ef'.repeat(32); });
  deny(x => { x.image.Id = manifest.slice(manifest.indexOf('sha256:')); });
  deny(x => { x.container.Image = manifest.slice(manifest.indexOf('sha256:')); });
  deny(x => { x.container.Image = 'sha256:'+'0'.repeat(64); });
  deny(x => { x.container.Image = 'sha256:INVALID'; });
});

test('R239 rejects a mutable alias or conflicting registry manifest', () => {
  deny(x => { x.container.Config.Image = 'nginxinc/nginx-unprivileged:stable'; });
  deny(x => { x.container.Config.Image = x.image.Id; });
  deny(x => { x.image.RepoDigests = []; });
  deny(x => { x.image.RepoDigests = [manifest, manifest]; });
  deny(x => { x.image.RepoDigests = ['another/repository@'+manifest.split('@')[1]]; });
  deny(x => { x.image.RepoDigests = ['nginxinc/nginx-unprivileged:stable']; });
  deny(x => { x.expectedImage = 'nginxinc/nginx-unprivileged@sha256:'+'ef'.repeat(32); });
});

test('R239 fails closed on malformed daemon records and accessors', () => {
  deny(x => { x.image.Os = 'windows'; });
  deny(x => { x.image.Architecture = '386'; });
  deny(x => { x.image.RepoDigests = 'SECRET-FIXTURE'; });
  deny(x => { x.image = null; });
  deny(x => { x.container = []; });
  deny(x => { x.container.Config = {}; });
  deny(x => { x.expectedImage = 'nginxinc/nginx-unprivileged@sha256:'+'a'.repeat(64); });
  const evil = fixture();
  Object.defineProperty(evil.image, 'Id', {
    enumerable: true,
    get() { throw Error('SECRET-FIXTURE getter executed'); }
  });
  assert.throws(() => review(evil), /R239/);
});

test('R239 operator-only CLI bounds untrusted JSON and emits no image or input data', () => {
  const script = fileURLToPath(new URL(
    '../scripts/faisca-review-image-identity.mjs', import.meta.url));
  const env = { ...process.env, GITHUB_ACTIONS: '',
    IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1',
    IMAGINE_FAISCA_NGINX_IMAGE: manifest };
  const run = (input, extra={}) => spawnSync(process.execPath,[script],{
    cwd: resolve(root), timeout: 15000, encoding: 'utf8',
    input, env: { ...env, ...extra }
  });
  const good = fixture();
  const body = JSON.stringify({
    container:[good.container], image:[good.image]
  });
  const success = run(body);
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).deploymentPerformed, false);
  const altered = fixture();
  altered.container.Image = 'sha256:'+'ef'.repeat(32);
  const failures = [
    run(body, { GITHUB_ACTIONS: 'true' }),
    run(body, { IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '' }),
    run(JSON.stringify({container:[altered.container],image:[altered.image]})),
    run(JSON.stringify({container:[good.container,good.container],image:[good.image]})),
    run(JSON.stringify({container:[good.container],image:[good.image],secret:'SECRET-FIXTURE'})),
    run('{BAD_JSON SECRET-FIXTURE'),
    run('X'.repeat(512*1024+1))
  ];
  for (const result of failures) {
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /unverified \(HOLD\)/);
  }
  for (const result of [success,...failures]) {
    for (const sensitive of [manifest,configId,'SECRET-FIXTURE']) {
      assert.equal((result.stdout+result.stderr).includes(sensitive), false);
    }
  }
});
