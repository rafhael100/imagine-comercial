/**
 * F254 — review the RESOLVED Docker Compose V2 JSON model before a private
 * staging operator considers starting a container.
 *
 * Input is a trusted operator-supplied 'docker compose config --format json'
 * output, not an actual Docker Engine observation. This function deliberately
 * cannot deploy, authorize publication or inspect live networking.
 */
import {isAbsolute,resolve} from 'node:path';
import {reviewPrivateStagingImage} from './private-staging-image-policy.mjs';

const REQUIRED_SERVICE_KEYS=new Set([
  'image','restart','ports','user','read_only','cap_drop','security_opt',
  'pids_limit','mem_limit','cpus','volumes','tmpfs','environment','networks',
  // Docker Compose v2 canonical JSON adds null defaults even when omitted
  // from reviewed YAML. Nonempty overrides remain forbidden.
  'command','entrypoint'
]);
const TARGETS=Object.freeze([
  '/usr/share/nginx/html',
  '/etc/nginx/conf.d/default.conf',
  '/etc/nginx/auth/.htpasswd'
]);
const FAIL='F254: effective staging Compose differs from the reviewed private model (HOLD)';
function object(value){
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype;
}
function requireThat(test){if(!test)throw Error(FAIL);}
function exactKeys(value,accepted){
  return object(value)&&Object.keys(value).every(key=>accepted.has(key));
}
function oneOf(value,...options){return options.some(candidate=>value===candidate);}
function isDefaultNetwork(value){
  if(value===undefined)return true;
  if(Array.isArray(value))return value.length===1&&value[0]==='default';
  return object(value)&&Object.keys(value).length===1&&
    Object.hasOwn(value,'default')&&
    (value.default===null||
      (object(value.default)&&Object.keys(value.default).length===0));
}
function checkVolume(volume,target,source){
  requireThat(exactKeys(volume,new Set(['type','source','target','read_only','bind'])));
  requireThat(volume.type==='bind'&&volume.target===target&&
    volume.source===source&&volume.read_only===true&&isAbsolute(volume.source));
  // Docker Compose may normalize an allowed short bind mount to create_host_path.
  if(volume.bind!==undefined)
    requireThat(exactKeys(volume.bind,new Set(['create_host_path']))&&
      typeof volume.bind.create_host_path==='boolean');
}
function checkPorts(value){
  requireThat(Array.isArray(value)&&value.length===1);
  const port=value[0];
  requireThat(exactKeys(port,new Set(['mode','target','published','protocol','host_ip','app_protocol','name'])));
  requireThat(port.host_ip==='127.0.0.1'&&
    oneOf(port.target,8080,'8080')&&oneOf(port.published,'4321',4321)&&
    (port.protocol===undefined||port.protocol==='tcp')&&
    (port.mode===undefined||port.mode==='ingress')&&
    port.app_protocol===undefined&&port.name===undefined);
}
function checkNetworks(root,service){
  requireThat(isDefaultNetwork(service.networks));
  if(root.networks===undefined)return;
  requireThat(object(root.networks)&&Object.keys(root.networks).length===1&&
    Object.hasOwn(root.networks,'default'));
  const n=root.networks.default;
  requireThat(object(n)&&
    exactKeys(n,new Set(['name']))&&
    (n.name===undefined||
      (typeof n.name==='string'&&/^[a-zA-Z0-9_.-]{1,128}$/.test(n.name))));
}
/**
 * expectedImage and expectedAuthPath come from the operator's already-
 * reviewed environment and are never copied into the returned report.
 */
export function reviewEffectivePrivateStagingCompose(
  document,{projectRoot,expectedImage,expectedAuthPath}={}
){
  requireThat(exactKeys(document,new Set(['name','services','networks','volumes'])));
  requireThat(object(document.services)&&
    Object.keys(document.services).length===1&&
    Object.hasOwn(document.services,'static-review'));
  requireThat(object(document.services['static-review']));
  requireThat(typeof projectRoot==='string'&&isAbsolute(projectRoot)&&
    typeof expectedAuthPath==='string'&&isAbsolute(expectedAuthPath)&&
    expectedAuthPath!==projectRoot&&
    !expectedAuthPath.startsWith(projectRoot+'/')&&
    expectedImage===document.services['static-review'].image);
  reviewPrivateStagingImage(expectedImage);
  if(document.name!==undefined)
    requireThat(typeof document.name==='string'&&
      /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(document.name));
  if(document.volumes!==undefined)
    requireThat(object(document.volumes)&&Object.keys(document.volumes).length===0);

  const service=document.services['static-review'];
  requireThat(exactKeys(service,REQUIRED_SERVICE_KEYS));
  for(const field of ['command','entrypoint']){
    const value=service[field];
    requireThat(value===undefined||value===null||
      (Array.isArray(value)&&value.length===0));
  }
  requireThat(service.user==='101:101'&&service.read_only===true&&
    service.restart==='no'&&
    Array.isArray(service.cap_drop)&&service.cap_drop.length===1&&
    service.cap_drop[0]==='ALL'&&
    Array.isArray(service.security_opt)&&service.security_opt.length===1&&
    service.security_opt[0]==='no-new-privileges:true'&&
    service.pids_limit===64&&
    oneOf(service.mem_limit,'256m',268435456)&&
    oneOf(service.cpus,0.5,'0.5'));
  requireThat(object(service.environment)&&
    Object.keys(service.environment).length===1&&service.environment.TZ==='UTC');
  requireThat(Array.isArray(service.tmpfs)&&service.tmpfs.length===2&&
    service.tmpfs[0]==='/tmp:rw,noexec,nosuid,size=32m'&&
    service.tmpfs[1]==='/var/run:rw,noexec,nosuid,size=4m');
  checkPorts(service.ports);
  checkNetworks(document,service);
  requireThat(Array.isArray(service.volumes)&&service.volumes.length===3);
  const volumes=new Map();
  for(const v of service.volumes){
    requireThat(object(v)&&TARGETS.includes(v.target)&&!volumes.has(v.target));
    volumes.set(v.target,v);
  }
  const root=resolve(projectRoot);
  checkVolume(volumes.get(TARGETS[0]),TARGETS[0],resolve(root,'dist'));
  checkVolume(volumes.get(TARGETS[1]),TARGETS[1],resolve(root,'ops/staging/nginx.conf'));
  checkVolume(volumes.get(TARGETS[2]),TARGETS[2],expectedAuthPath);
  return Object.freeze({
    schema:'imagine.comercial.effective-staging-compose-review.v1',
    status:'RESOLVED_CONFIG_MODEL_REVIEW_ONLY',
    localLoopbackPort:true,
    singleUnprivilegedService:true,
    allThreeMountsReadOnly:true,
    sourceAndEffectiveConfigurationMustBeReviewedSeparately:true,
    actualDockerContainerInspected:false,
    actualNetworkExposureVerified:false,
    imageProvenanceIndependentlyVerified:false,
    tlsAndSshVerified:false,
    canDeploy:false,
    deploymentAuthorized:false,
    deploymentPerformed:false
  });
}
