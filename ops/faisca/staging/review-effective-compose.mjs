/**
 * R235 — read-only review of Docker Compose's RESOLVED Faísca private
 * staging JSON model. It cannot observe the running Docker daemon.
 *
 * Source YAML checks in verify-kit.mjs do not validate environment expansion,
 * override files or an operator-supplied Compose invocation. The caller must
 * obtain "docker compose -f ops/faisca/staging/compose.yaml config --format json"
 * separately, inspect independently pinned image/source inputs and invoke this
 * reviewer BEFORE considering any private operational action.
 */
import { isAbsolute, resolve } from 'node:path';
import { reviewPrivateStagingImage } from '../../../src/lib/private-staging-image-policy.mjs';

const FAIL = 'R235: resolved Faísca staging Compose differs from reviewed private policy (HOLD)';
const SERVICE_KEYS = new Set([
  'image','restart','ports','user','read_only','cap_drop','security_opt',
  'pids_limit','mem_limit','cpus','volumes','tmpfs','environment','networks',
  'command','entrypoint'
]);
const ROOT_KEYS = new Set(['name','services','networks','volumes']);
const TARGETS = [
  '/usr/share/nginx/html',
  '/etc/nginx/conf.d/default.conf',
  '/etc/nginx/auth/.htpasswd'
];
const VOLUME_KEYS = new Set(['type','source','target','read_only','bind']);
const PORT_KEYS = new Set(['mode','target','published','protocol','host_ip','app_protocol','name']);
const NETWORK_KEYS = new Set(['name','ipam']);
const has = (obj, key) => Object.hasOwn(obj, key);
function plain(v) {
  return v !== null && typeof v === 'object' &&
    !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}
function demand(ok) { if (!ok) throw Error(FAIL); }
function keys(v, accepted) {
  return plain(v) && Object.keys(v).every(k => accepted.has(k));
}
function exact(v, entries) {
  return plain(v) && Object.keys(v).length === entries.length &&
    entries.every(([key, value]) => has(v, key) && v[key] === value);
}
function defaultNetwork(v) {
  return v === undefined ||
    (Array.isArray(v) && v.length === 1 && v[0] === 'default') ||
    (plain(v) && Object.keys(v).length === 1 && has(v, 'default') &&
      (v.default === null || exact(v.default, [])));
}
function networks(root, service) {
  demand(defaultNetwork(service.networks));
  if (root.networks === undefined) return;
  demand(plain(root.networks) && Object.keys(root.networks).length === 1 &&
    has(root.networks, 'default') && keys(root.networks.default, NETWORK_KEYS));
  const n = root.networks.default;
  demand(n.name === undefined || (typeof n.name === 'string' &&
    /^[a-zA-Z0-9_.-]{1,128}$/.test(n.name)));
  if (n.ipam !== undefined) {
    demand(keys(n.ipam, new Set(['driver','config','options'])) &&
      (n.ipam.driver === undefined || n.ipam.driver === 'default') &&
      (n.ipam.config === undefined ||
        (Array.isArray(n.ipam.config) && n.ipam.config.length === 0)) &&
      (n.ipam.options === undefined || exact(n.ipam.options, [])));
  }
}
function port(v) {
  demand(Array.isArray(v) && v.length === 1 && keys(v[0], PORT_KEYS));
  const p = v[0];
  demand(p.host_ip === '127.0.0.1' &&
    (p.target === 8080 || p.target === '8080') &&
    (p.published === 4337 || p.published === '4337') &&
    (p.mode === undefined || p.mode === 'ingress') &&
    (p.protocol === undefined || p.protocol === 'tcp') &&
    p.app_protocol === undefined && p.name === undefined);
}
function volume(v, target, source) {
  demand(keys(v, VOLUME_KEYS) && v.type === 'bind' &&
    v.target === target && v.source === source &&
    v.read_only === true && isAbsolute(v.source));
  if (v.bind !== undefined) {
    demand(keys(v.bind, new Set(['create_host_path'])) &&
      (v.bind.create_host_path === undefined ||
       typeof v.bind.create_host_path === 'boolean'));
  }
}
function eligiblePath(path) {
  return typeof path === 'string' && isAbsolute(path) &&
    path === resolve(path) && !/[\r\n\0]/.test(path);
}
/**
 * Inputs expectedImage/site/auth must be independently operator-reviewed,
 * not simply copied from the supplied JSON. Nothing sensitive is returned.
 */
export function reviewEffectiveFaiscaStagingCompose(
  document, { expectedImage, expectedSitePath, expectedAuthPath, expectedConfigPath } = {}
) {
  demand(keys(document, ROOT_KEYS) &&
    plain(document.services) && Object.keys(document.services).length === 1 &&
    has(document.services, 'faisca-review'));
  const service = document.services['faisca-review'];
  demand(keys(service, SERVICE_KEYS) && typeof expectedImage === 'string' &&
    service.image === expectedImage);
  reviewPrivateStagingImage(expectedImage);
  demand([expectedSitePath, expectedAuthPath, expectedConfigPath].every(eligiblePath) &&
    new Set([expectedSitePath, expectedAuthPath, expectedConfigPath]).size === 3);
  if (document.name !== undefined)
    demand(typeof document.name === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(document.name));
  if (document.volumes !== undefined) demand(exact(document.volumes, []));
  networks(document, service);

  for (const field of ['command','entrypoint']) {
    demand(service[field] === undefined || service[field] === null ||
      (Array.isArray(service[field]) && service[field].length === 0));
  }
  demand(service.user === '101:101' && service.restart === 'no' &&
    service.read_only === true && service.pids_limit === 64 &&
    (service.mem_limit === 268435456 || service.mem_limit === '268435456' ||
     service.mem_limit === '256m') &&
    (service.cpus === 0.5 || service.cpus === '0.5') &&
    Array.isArray(service.cap_drop) && service.cap_drop.length === 1 &&
    service.cap_drop[0] === 'ALL' &&
    Array.isArray(service.security_opt) && service.security_opt.length === 1 &&
    service.security_opt[0] === 'no-new-privileges:true' &&
    exact(service.environment, [['TZ','UTC']]) &&
    Array.isArray(service.tmpfs) && service.tmpfs.length === 2 &&
    service.tmpfs[0] === '/tmp:rw,noexec,nosuid,size=32m' &&
    service.tmpfs[1] === '/var/run:rw,noexec,nosuid,size=4m');
  port(service.ports);
  demand(Array.isArray(service.volumes) && service.volumes.length === TARGETS.length);
  const mounts = new Map();
  for (const v of service.volumes) {
    demand(plain(v) && TARGETS.includes(v.target) && !mounts.has(v.target));
    mounts.set(v.target, v);
  }
  volume(mounts.get(TARGETS[0]), TARGETS[0], expectedSitePath);
  volume(mounts.get(TARGETS[1]), TARGETS[1], expectedConfigPath);
  volume(mounts.get(TARGETS[2]), TARGETS[2], expectedAuthPath);
  return Object.freeze({
    schema: 'faisca.private-staging-resolved-compose-review.v1',
    status: 'RESOLVED_COMPOSE_MODEL_REVIEW_ONLY',
    serviceCount: 1,
    loopbackOnlyPort: true,
    reviewedReadOnlyMounts: 3,
    sourceConfigMustBeCheckedSeparately: true,
    runtimeContainerInspected: false,
    actualNetworkExposureVerified: false,
    imageProvenanceVerified: false,
    externalCostReconciled: false,
    canDeploy: false,
    deploymentAuthorized: false,
    deploymentPerformed: false,
    publicFaiscaEnabled: false
  });
}
