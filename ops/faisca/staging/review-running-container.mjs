/**
 * R236: read-only validation of ONE Docker inspect record for the PRIVATE
 * Faísca review container. This is a comparison of untrusted operator-
 * supplied evidence, not proof of Docker access by this module.
 * Does not inspect HTTP, credentials, TLS, image signatures or firewall.
 */
import { isAbsolute, resolve, dirname } from 'node:path';
import { reviewPrivateStagingImage } from '../../../src/lib/private-staging-image-policy.mjs';

const HOLD = 'R236: running Faísca private container not verified (HOLD)';
const insist = x => { if (!x) throw Error(HOLD); };
const plain = x => x !== null && typeof x === 'object' &&
  !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const pathOK = x => typeof x === 'string' && isAbsolute(x) && x === resolve(x) &&
  !/[\r\n\0]/.test(x);
const only = (obj, fields) => plain(obj) &&
  Object.keys(obj).length === fields.length &&
  fields.every(f => Object.hasOwn(obj, f));
const PORT = { HostIp: '127.0.0.1', HostPort: '4337' };
const MOUNTS = [
  ['/usr/share/nginx/html', 'expectedSitePath'],
  ['/etc/nginx/conf.d/default.conf', 'expectedConfigPath'],
  ['/etc/nginx/auth/.htpasswd', 'expectedAuthPath']
];
function binding(x) {
  return only(x, ['HostIp','HostPort']) &&
    x.HostIp === PORT.HostIp && x.HostPort === PORT.HostPort;
}
function ports(host, net) {
  const bindings = host.PortBindings;
  insist(plain(bindings) && Object.keys(bindings).length === 1 &&
    Array.isArray(bindings['8080/tcp']) && bindings['8080/tcp'].length === 1 &&
    binding(bindings['8080/tcp'][0]));
  insist(host.PublishAllPorts === false && plain(net.Ports));
  const open = Object.entries(net.Ports).filter(([, values]) =>
    values !== null && Array.isArray(values) && values.length > 0);
  insist(open.length === 1 && open[0][0] === '8080/tcp' &&
    open[0][1].length === 1 && binding(open[0][1][0]));
}
function mounts(inspect, expected) {
  insist(Array.isArray(inspect.Mounts) && inspect.Mounts.length === MOUNTS.length);
  const seen = new Set();
  for (const m of inspect.Mounts) {
    insist(plain(m) && m.Type === 'bind' &&
      typeof m.Destination === 'string' && !seen.has(m.Destination) &&
      MOUNTS.some(([target,key]) =>
        m.Destination === target && m.Source === expected[key]) &&
      m.RW === false);
    seen.add(m.Destination);
  }
  insist(seen.size === MOUNTS.length);
}
/**
 * The resolved Compose model (R235) specifies exactly two small, noexec,
 * nosuid tmpfs mounts. R236 originally checked only the three read-only bind
 * mounts, so a running container with absent or unlimited tmpfs passed.
 * Docker inspect HostConfig.Tmpfs is independent runtime evidence.
 */
function boundedTmpfs(host) {
  const entries = host.Tmpfs;
  insist(plain(entries) && Object.keys(entries).length === 2 &&
    Object.hasOwn(entries, '/tmp') && Object.hasOwn(entries, '/var/run'));
  for (const [target, sizes] of [
    ['/tmp', ['32m', '33554432']],
    ['/var/run', ['4m', '4194304']]
  ]) {
    const raw = entries[target];
    insist(typeof raw === 'string' && raw.length <= 96);
    const options = raw.split(',');
    insist(options.length === 4 && new Set(options).size === 4 &&
      options.includes('rw') && options.includes('noexec') &&
      options.includes('nosuid'));
    const size = options.find(x => x.startsWith('size='));
    insist(typeof size === 'string' && sizes.includes(size.slice(5)));
  }
}
function privileges(host) {
  insist(host.Privileged === false && host.ReadonlyRootfs === true &&
    host.RestartPolicy?.Name === 'no' &&
    host.PidsLimit === 64 && host.Memory === 268435456 &&
    host.NanoCpus === 500000000 &&
    Array.isArray(host.CapDrop) && host.CapDrop.length === 1 &&
    typeof host.CapDrop[0] === 'string' &&
    host.CapDrop[0].toUpperCase() === 'ALL' &&
    (host.CapAdd === undefined || host.CapAdd === null ||
      (Array.isArray(host.CapAdd) && host.CapAdd.length === 0)) &&
    Array.isArray(host.SecurityOpt) && host.SecurityOpt.length === 1 &&
    ['no-new-privileges:true', 'no-new-privileges'].includes(host.SecurityOpt[0]));
}
function network(inspect, project) {
  const name = project + '_default';
  insist(inspect.HostConfig.NetworkMode === name && plain(inspect.NetworkSettings.Networks) &&
    Object.keys(inspect.NetworkSettings.Networks).length === 1 &&
    Object.hasOwn(inspect.NetworkSettings.Networks, name) &&
    plain(inspect.NetworkSettings.Networks[name]));
}
/**
 * All options must be obtained from independent, operator-reviewed inputs.
 * No supplied identifier, port, network, path, IP or digest is logged.
 */
export function reviewRunningFaiscaPrivateContainer({
  inspect, expectedImage, expectedSitePath, expectedConfigPath,
  expectedAuthPath, expectedComposePath, expectedWorkingDir
} = {}) {
  const expected = {
    expectedSitePath, expectedConfigPath, expectedAuthPath,
    expectedComposePath, expectedWorkingDir
  };
  insist(plain(inspect) && plain(inspect.State) && plain(inspect.Config) &&
    plain(inspect.HostConfig) && plain(inspect.NetworkSettings) &&
    Object.values(expected).every(pathOK) &&
    new Set([expectedSitePath, expectedConfigPath, expectedAuthPath]).size === 3 &&
    expectedComposePath === resolve(dirname(expectedConfigPath), 'compose.yaml') &&
    expectedConfigPath === resolve(expectedWorkingDir, 'ops/faisca/staging/nginx.conf'));
  reviewPrivateStagingImage(expectedImage);
  const { State: state, Config: config, HostConfig: host } = inspect;
  const labels = config.Labels;
  const project = labels?.['com.docker.compose.project'];
  insist(state.Running === true && state.Status === 'running' &&
    state.Paused === false && state.Restarting === false && state.Dead === false &&
    config.Image === expectedImage && config.User === '101:101' &&
    typeof project === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(project) &&
    labels['com.docker.compose.service'] === 'faisca-review' &&
    labels['com.docker.compose.oneoff'] === 'False' &&
    [expectedWorkingDir, dirname(expectedComposePath)]
      .includes(labels['com.docker.compose.project.working_dir']) &&
    labels['com.docker.compose.project.config_files'] === expectedComposePath &&
    Array.isArray(config.Env) && config.Env.includes('TZ=UTC') &&
    config.Env.every(x => typeof x === 'string' &&
      !/^(?:IMAGINE_|AWS_|AZURE_|OPENAI_|DATABASE_URL=|SECRET=|TOKEN=)/.test(x)));
  privileges(host);
  boundedTmpfs(host);
  ports(host, inspect.NetworkSettings);
  network(inspect, project);
  mounts(inspect, expected);
  return Object.freeze({
    schema: 'faisca.private-staging-running-container-review.v1',
    status: 'DOCKER_INSPECT_FIELDS_MATCH_REVIEW_ONLY',
    inspectedOneRunningContainerRecord: true,
    reportedLoopbackBinding: true,
    reportedUnprivilegedReadOnlyMounts: true,
    reportedBoundedNoexecTmpfs: true,
    reportedResourceLimits: true,
    dockerAccessPerformedByThisModule: false,
    actualNetworkExposureIndependentlyVerified: false,
    runningNginxConfigurationVerified: false,
    authenticatedHttpVerified: false,
    imageProvenanceVerified: false,
    approvalToDeploy: false,
    publicFaiscaEnabled: false
  });
}
