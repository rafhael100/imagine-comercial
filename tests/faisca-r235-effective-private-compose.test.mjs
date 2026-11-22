import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewEffectiveFaiscaStagingCompose as review }
  from '../ops/faisca/staging/review-effective-compose.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const image = 'nginxinc/nginx-unprivileged@sha256:' + 'ab'.repeat(32);
const site = '/tmp/faisca-r235-fixture-reviewed-site';
const auth = '/tmp/faisca-r235-fixture-private-htpasswd';
const conf = resolve(root, 'ops/faisca/staging/nginx.conf');
const options = () => ({
  expectedImage: image, expectedSitePath: site,
  expectedAuthPath: auth, expectedConfigPath: conf
});
function fixture() {
  return {
    name: 'faisca-private-review',
    services: {
      'faisca-review': {
        image, restart: 'no', user: '101:101', read_only: true,
        cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'],
        pids_limit: 64, mem_limit: '256m', cpus: 0.5,
        environment: { TZ: 'UTC' }, networks: { default: null },
        ports: [{ mode: 'ingress', target: 8080, published: '4337',
          protocol: 'tcp', host_ip: '127.0.0.1' }],
        volumes: [
          { type: 'bind', source: site, target: '/usr/share/nginx/html',
            read_only: true, bind: { create_host_path: true } },
          { type: 'bind', source: conf,
            target: '/etc/nginx/conf.d/default.conf', read_only: true },
          { type: 'bind', source: auth,
            target: '/etc/nginx/auth/.htpasswd', read_only: true }
        ],
        tmpfs: ['/tmp:rw,noexec,nosuid,size=32m',
          '/var/run:rw,noexec,nosuid,size=4m']
      }
    },
    networks: { default: { name: 'faisca_review_default' } }
  };
}
function mutate(change) {
  const doc = structuredClone(fixture());
  change(doc, doc.services['faisca-review']);
  return doc;
}

test('R235 accepts only the reviewed resolved model but never grants deployment', () => {
  const output = review(fixture(), options());
  assert.equal(output.status, 'RESOLVED_COMPOSE_MODEL_REVIEW_ONLY');
  assert.equal(output.serviceCount, 1);
  assert.equal(output.loopbackOnlyPort, true);
  assert.equal(output.reviewedReadOnlyMounts, 3);
  assert.equal(output.publicFaiscaEnabled, false);
  assert.equal(output.deploymentAuthorized, false);
  assert.equal(output.deploymentPerformed, false);
  assert.equal(output.runtimeContainerInspected, false);
  assert.equal(output.actualNetworkExposureVerified, false);
  assert.equal(output.externalCostReconciled, false);
  assert.ok(Object.isFrozen(output));
  for (const sensitive of [image, auth, site, conf])
    assert.equal(JSON.stringify(output).includes(sensitive), false);

  const normalized = mutate((d,s) => {
    s.command = null;
    s.entrypoint = [];
    s.mem_limit = 268435456;
    s.cpus = '0.5';
    d.networks.default.ipam = { driver: 'default', config: [] };
  });
  assert.equal(review(normalized, options()).deploymentAuthorized, false);
});

test('R235 rejects resolved exposure, privileges, extra services and commands', () => {
  const attacks = [
    (_d,s) => { s.ports[0].host_ip = '0.0.0.0'; },
    (_d,s) => { delete s.ports[0].host_ip; },
    (_d,s) => { s.ports[0].published = '80'; },
    (_d,s) => { s.ports.push({ ...s.ports[0], published: '4338' }); },
    (_d,s) => { s.ports[0].protocol = 'udp'; },
    (_d,s) => { s.ports[0].name = 'unexpected'; },
    (d) => { d.services.extra = { image: 'nginx:latest' }; },
    (_d,s) => { s.network_mode = 'host'; },
    (_d,s) => { s.privileged = true; },
    (_d,s) => { s.user = '0:0'; },
    (_d,s) => { s.read_only = false; },
    (_d,s) => { s.cap_add = ['NET_ADMIN']; },
    (_d,s) => { s.cap_drop = []; },
    (_d,s) => { s.security_opt = ['no-new-privileges:false']; },
    (_d,s) => { s.restart = 'always'; },
    (_d,s) => { s.pids_limit = 1024; },
    (_d,s) => { s.mem_limit = '1g'; },
    (_d,s) => { s.cpus = 3; },
    (_d,s) => { s.environment.UNSAFE = 'SECRET-FIXTURE'; },
    (_d,s) => { s.command = ['sh','-c','printenv']; },
    (_d,s) => { s.entrypoint = ['bash']; },
    (_d,s) => { s.tmpfs = ['/tmp:exec']; },
    (d) => { d.networks.default.external = true; },
    (d) => { d.networks.default.ipam = { config: [{subnet:'0.0.0.0/0'}] }; },
    (d) => { d.secrets = { secret: 'fixture' }; },
    (d) => { d.volumes = { unexpected: {} }; },
    (_d,s) => { s.image = 'nginx:latest'; },
    (_d,s) => { s.networks = { outside: null }; }
  ];
  for (const attack of attacks)
    assert.throws(() => review(mutate(attack), options()), /R235|F164/);
});

test('R235 rejects rewritten binds, credential paths and mount escapes', () => {
  const attacks = [
    (_d,s) => { s.volumes[0].read_only = false; },
    (_d,s) => { s.volumes[2].read_only = false; },
    (_d,s) => { s.volumes[0].source = '/tmp/unpinned-site'; },
    (_d,s) => { s.volumes[1].source = '/tmp/unpinned-nginx'; },
    (_d,s) => { s.volumes[2].source = '/tmp/wrong-auth'; },
    (_d,s) => { s.volumes[0].type = 'volume'; },
    (_d,s) => { s.volumes[0].bind.propagation = 'rshared'; },
    (_d,s) => { s.volumes.push({ ...s.volumes[0],
      target: '/var/run/docker.sock' }); },
    (_d,s) => { s.volumes[2].target = '/etc/nginx/conf.d/default.conf'; },
    (_d,s) => { s.volumes[0].bind.create_host_path = 'true'; }
  ];
  for (const attack of attacks)
    assert.throws(() => review(mutate(attack), options()), /R235/);
  for (const wrong of [
    { ...options(), expectedImage: 'nginx:latest' },
    { ...options(), expectedSitePath: 'relative/site' },
    { ...options(), expectedAuthPath: site },
    { ...options(), expectedConfigPath: '/tmp/../tmp/bad' }
  ]) assert.throws(() => review(fixture(), wrong), /R235|F164/);
});

test('R235 malformed or incomplete JSON-derived objects fail closed', () => {
  for (const input of [null, [], 'oops', {}, { services: {} },
    { services: { 'faisca-review': null } },
    { services: { 'faisca-review': {} } }])
    assert.throws(() => review(input, options()), /R235/);
});

test('R235 operator CLI reads bounded UTF-8 and does not log sensitive data', () => {
  const path = fileURLToPath(new URL(
    '../scripts/faisca-review-effective-compose.mjs', import.meta.url));
  const env = { ...process.env, GITHUB_ACTIONS: '',
    IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1',
    IMAGINE_FAISCA_NGINX_IMAGE: image,
    IMAGINE_FAISCA_STAGING_SITE_DIR: site,
    IMAGINE_FAISCA_STAGING_HTPASSWD_PATH: auth };
  const run = (input, extra = {}) => spawnSync(process.execPath, [path], {
    cwd: root, env: { ...env, ...extra }, input, encoding: 'utf8',
    timeout: 15000
  });
  const valid = run(JSON.stringify(fixture()));
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).deploymentAuthorized, false);
  const deniedCI = run(JSON.stringify(fixture()), { GITHUB_ACTIONS: 'true' });
  assert.equal(deniedCI.status, 2);
  const malicious = run(JSON.stringify(
    mutate((_d,s) => { s.privileged = true; })));
  assert.equal(malicious.status, 2);
  const malformed = run('{bad JSON SECRET-FIXTURE');
  assert.equal(malformed.status, 2);
  const oversized = run('X'.repeat(65537));
  assert.equal(oversized.status, 2);
  const deniedMode = run(JSON.stringify(fixture()), {
    IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: ''
  });
  assert.equal(deniedMode.status, 2);
  for (const result of [valid, deniedCI, malicious, malformed, oversized, deniedMode]) {
    if (result.status === 2) {
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /not verified \(HOLD\)/);
    }
    for (const sensitive of [image, site, auth, conf, 'SECRET-FIXTURE'])
      assert.equal((result.stdout + result.stderr).includes(sensitive), false);
  }
});
