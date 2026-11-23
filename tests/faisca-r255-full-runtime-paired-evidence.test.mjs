import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewFaiscaPrivateFullRuntimePair as review } from
  '../ops/faisca/staging/review-private-full-runtime-pair.mjs';

const cli = fileURLToPath(new URL('../scripts/faisca-review-full-runtime-staging.mjs', import.meta.url));
const imageRef = 'nginxinc/nginx-unprivileged@sha256:' + 'ab'.repeat(32);
const imageId = 'sha256:' + 'cd'.repeat(32);
const workdir = '/srv/faisca-private/review';
const site = '/srv/faisca-private/site';
const auth = '/srv/faisca-private/auth/htpasswd';
const compose = workdir + '/ops/faisca/staging/compose.yaml';
const config = workdir + '/ops/faisca/staging/nginx.conf';
const bound = () => ({ HostIp: '127.0.0.1', HostPort: '4337' });

function fixture() {
  return {
    container: [{
      Image: imageId,
      State: { Running: true, Status: 'running',
        Paused: false, Restarting: false, Dead: false },
      Config: {
        Image: imageRef, User: '101:101', Env: ['TZ=UTC'],
        Labels: {
          'com.docker.compose.project': 'faisca-private',
          'com.docker.compose.service': 'faisca-review',
          'com.docker.compose.oneoff': 'False',
          'com.docker.compose.project.working_dir': workdir,
          'com.docker.compose.project.config_files': compose
        }
      },
      HostConfig: {
        Privileged: false, ReadonlyRootfs: true,
        PublishAllPorts: false,
        RestartPolicy: { Name: 'no' },
        PidsLimit: 64, Memory: 268435456, NanoCpus: 500000000,
        CapDrop: ['ALL'], CapAdd: [],
        SecurityOpt: ['no-new-privileges:true'],
        NetworkMode: 'faisca-private_default',
        PortBindings: { '8080/tcp': [bound()] },
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=32m',
          '/var/run': 'rw,noexec,nosuid,size=4m'
        }
      },
      NetworkSettings: {
        Ports: { '8080/tcp': [bound()], '8443/tcp': null },
        Networks: { 'faisca-private_default': {} }
      },
      Mounts: [
        { Type: 'bind', Destination: '/usr/share/nginx/html', Source: site, RW: false },
        { Type: 'bind', Destination: '/etc/nginx/conf.d/default.conf', Source: config, RW: false },
        { Type: 'bind', Destination: '/etc/nginx/auth/.htpasswd', Source: auth, RW: false }
      ]
    }],
    image: [{ Id: imageId, RepoDigests: [imageRef], Os: 'linux', Architecture: 'amd64' }]
  };
}
function options(data) {
  return {
    container: data.container[0], image: data.image[0],
    expectedImage: imageRef, expectedWorkingDir: workdir,
    expectedSitePath: site, expectedAuthPath: auth
  };
}
const pairedReport = () => ({
  status: 'REPORTED_DOCKER_BINDING_AND_LOCAL_NOAUTH_HTTP_REVIEW_ONLY',
  noAuthHttpProbesPassed: 19,
  reportedImageIdentityMatchesIndependentPin: true,
  reportedDockerPortMatchesProbedLoopbackPort: true,
  reviewedDefaultStagingPort: true,
  noCredentialsSent: true,
  dockerInspectionPerformed: false,
  dockerToHttpProcessOwnershipIndependentlyVerified: false,
  authenticatedConversationVerified: false,
  providerSpendReconciled: false,
  publicReady: false,
  deploymentAuthorized: false,
  publicFaiscaEnabled: false
});

test('R255: complete declared policy runs before the paired HTTP evidence', async () => {
  const data = fixture();
  let calls = 0;
  const result = await review(options(data), {
    pairedReview: async args => {
      calls++;
      assert.equal(args.container, data.container[0]);
      assert.equal(args.image, data.image[0]);
      assert.equal(args.expectedImage, imageRef);
      assert.equal(args.port, 4337);
      return pairedReport();
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'REPORTED_RUNTIME_POLICY_AND_LOOPBACK_HTTP_REVIEW_ONLY');
  assert.equal(result.noAuthHttpProbesPassed, 19);
  assert.equal(result.reportedRuntimePolicyFieldsMatch, true);
  assert.equal(result.dockerInspectionPerformed, false);
  assert.equal(result.dockerToHttpProcessOwnershipIndependentlyVerified, false);
  assert.equal(result.authenticatedConversationVerified, false);
  assert.equal(result.providerSpendReconciled, false);
  assert.equal(result.publicReady, false);
  assert.equal(result.publicFaiscaEnabled, false);
  assert.ok(Object.isFrozen(result));
  assert.doesNotMatch(JSON.stringify(result), /faisca-private|sha256:|htpasswd|127\.0\.0\.1/);
});

test('R255: privilege, tmpfs, mount, host networking or secret drift stops BEFORE HTTP', async () => {
  const mutations = [
    x => { x.container[0].HostConfig.Privileged = true; },
    x => { x.container[0].HostConfig.CapAdd = ['SYS_ADMIN']; },
    x => { x.container[0].HostConfig.ReadonlyRootfs = false; },
    x => { x.container[0].HostConfig.Tmpfs['/tmp'] = 'rw,size=32m'; },
    x => { x.container[0].HostConfig.Tmpfs['/var/run'] = 'rw,noexec,nosuid,size=64m'; },
    x => { x.container[0].HostConfig.PidMode = 'host'; },
    x => { x.container[0].HostConfig.Devices = [{ PathOnHost: '/dev/null' }]; },
    x => { x.container[0].HostConfig.Dns = ['8.8.8.8']; },
    x => { x.container[0].Mounts[0].RW = true; },
    x => { x.container[0].Mounts.push({ Type: 'volume', Destination: '/extra', RW: true }); },
    x => { x.container[0].Config.Env.push('OPENAI_API_KEY=SECRET-FIXTURE'); },
    x => { x.container[0].HostConfig.PortBindings['8080/tcp'][0].HostIp = '0.0.0.0'; },
    x => { x.container[0].NetworkSettings.Networks = { bridge: {} }; },
    x => { x.container[0].Config.Labels['com.docker.compose.project.config_files'] = '/tmp/other.yaml'; },
    x => { x.container[0].State.Paused = true; }
  ];
  for (const mutate of mutations) {
    const data = fixture();
    mutate(data);
    let calls = 0;
    await assert.rejects(
      review(options(data), { pairedReview: async () => {
        calls++;
        return pairedReport();
      } }), /R255: full private runtime and HTTP review unverified \(HOLD\)/
    );
    assert.equal(calls, 0);
  }
});

test('R255: reject overclaimed or incomplete R253 output and suppress secret exceptions', async () => {
  const mutations = [
    x => { x.noAuthHttpProbesPassed = 18; },
    x => { x.status = 'PASS'; },
    x => { x.publicReady = true; },
    x => { x.noCredentialsSent = false; },
    x => { x.authenticatedConversationVerified = true; },
    x => { x.reviewedDefaultStagingPort = false; },
    x => { x.providerSpendReconciled = true; }
  ];
  for (const mutate of mutations) {
    const data = fixture();
    const output = pairedReport();
    mutate(output);
    await assert.rejects(
      review(options(data), { pairedReview: async () => output }),
      /R255: full private runtime and HTTP review unverified \(HOLD\)/
    );
  }
  await assert.rejects(
    review(options(fixture()), {
      pairedReview: async () => { throw Error('SECRET-FIXTURE'); }
    }), /^Error: R255: full private runtime and HTTP review unverified \(HOLD\)$/
  );
});

async function runCli(input, extraEnv = {}, argv = []) {
  const env = {
    ...process.env, CI: '', GITHUB_ACTIONS: '',
    IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1',
    IMAGINE_FAISCA_NGINX_IMAGE: imageRef,
    IMAGINE_FAISCA_STAGING_WORKDIR: workdir,
    IMAGINE_FAISCA_STAGING_SITE_DIR: site,
    IMAGINE_FAISCA_STAGING_HTPASSWD_PATH: auth,
    ...extraEnv
  };
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [cli, ...argv], {
      env, stdio: ['pipe','pipe','pipe']
    });
    let stdout = '', stderr = '';
    p.stdout.on('data', x => { stdout += x.toString(); });
    p.stderr.on('data', x => { stderr += x.toString(); });
    p.once('error', reject);
    p.once('close', code => resolve({ code, stdout, stderr }));
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}

test('R255 CLI: refuse CI, invalid evidence, unsafe host or any argument without leaking', async () => {
  const data = JSON.stringify(fixture());
  const cases = [
    [data, { GITHUB_ACTIONS: 'true' }, []],
    [data, { CI: 'true' }, []],
    [data, { IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '' }, []],
    [data, { IMAGINE_FAISCA_STAGING_WORKDIR: 'relative' }, []],
    [data, { IMAGINE_FAISCA_NGINX_IMAGE: 'nginx:latest' }, []],
    ['{"container":[],"image":[],"secret":"SECRET-FIXTURE"}', {}, []],
    ['SECRET-FIXTURE', {}, []],
    [data, {}, ['--host','example.invalid']],
    [data, {}, ['--port','4338']]
  ];
  for (const [input, env, args] of cases) {
    const output = await runCli(input, env, args);
    assert.equal(output.code, 2);
    assert.equal(output.stdout, '');
    assert.equal(output.stderr,
      'R255: full private runtime and HTTP review unverified (HOLD)\n');
    assert.ok(!output.stderr.includes(imageRef));
    assert.ok(!output.stderr.includes(site));
  }
});
