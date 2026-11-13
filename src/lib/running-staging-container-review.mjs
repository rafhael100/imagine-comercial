/**
 * F256 — read-only validation of one Docker Engine INSPECT response.
 *
 * Unlike F253 (source) and F254 (Compose's resolved plan), this checks
 * selected fields reported by the ACTUAL running Docker daemon.
 * The caller must still independently verify firewall, TLS, image provenance,
 * authentication, UID file readability and the full HTTP byte-parity gate.
 *
 * No deployment authority is emitted by this library.
 */
import {isAbsolute,resolve} from 'node:path';
import {reviewPrivateStagingImage} from './private-staging-image-policy.mjs';

const HOLD='F256: running private staging container not verified (HOLD)';
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  Object.getPrototypeOf(v)===Object.prototype;
const insist=condition=>{if(!condition)throw Error(HOLD);};
const array=v=>Array.isArray(v)?v:[];
const same=(a,b)=>a===b;
const cleanPath=(value)=>typeof value==='string'&&isAbsolute(value)&&
  value===resolve(value);
const expectedTargets=[
  '/usr/share/nginx/html',
  '/etc/nginx/conf.d/default.conf',
  '/etc/nginx/auth/.htpasswd'
];
const validProject=name=>typeof name==='string'&&
  /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name);
const onlyKeys=(obj,keys)=>plain(obj)&&
  Object.keys(obj).length===keys.length&&
  keys.every(k=>Object.hasOwn(obj,k));

function boundPort(hostConfig,networkSettings){
  const bindings=hostConfig.PortBindings;
  insist(plain(bindings)&&Object.keys(bindings).length===1&&
    Array.isArray(bindings['8080/tcp'])&&bindings['8080/tcp'].length===1);
  const b=bindings['8080/tcp'][0];
  insist(onlyKeys(b,['HostIp','HostPort'])&&
    b.HostIp==='127.0.0.1'&&b.HostPort==='4321');
  const observed=networkSettings.Ports;
  insist(plain(observed));
  const active=Object.entries(observed).filter(([,v])=>v!==null&&
    Array.isArray(v)&&v.length>0);
  insist(active.length===1&&active[0][0]==='8080/tcp'&&
    active[0][1].length===1);
  insist(onlyKeys(active[0][1][0],['HostIp','HostPort'])&&
    active[0][1][0].HostIp==='127.0.0.1'&&
    active[0][1][0].HostPort==='4321');
  insist(hostConfig.PublishAllPorts===false);
}
function approvedMounts(mounts,root,authPath){
  insist(Array.isArray(mounts)&&mounts.length===3);
  const expected=new Map([
    [expectedTargets[0],resolve(root,'dist')],
    [expectedTargets[1],resolve(root,'ops/staging/nginx.conf')],
    [expectedTargets[2],authPath]
  ]);
  const seen=new Set();
  for(const m of mounts){
    insist(plain(m)&&m.Type==='bind'&&
      typeof m.Destination==='string'&&!seen.has(m.Destination)&&
      expected.has(m.Destination)&&
      m.Source===expected.get(m.Destination)&&
      m.RW===false);
    seen.add(m.Destination);
  }
  insist(seen.size===expected.size);
}
function approvedNetwork(inspect,hostConfig,project){
  const name=project+'_default';
  insist(hostConfig.NetworkMode===name&&
    !['host','bridge','none'].includes(hostConfig.NetworkMode));
  const networks=inspect.NetworkSettings.Networks;
  insist(plain(networks)&&Object.keys(networks).length===1&&
    Object.hasOwn(networks,name));
  insist(plain(networks[name]));
}
function approvedLimits(hostConfig){
  insist(hostConfig.Privileged===false&&
    hostConfig.ReadonlyRootfs===true&&
    hostConfig.RestartPolicy?.Name==='no'&&
    hostConfig.PidsLimit===64&&
    hostConfig.Memory===268435456&&
    hostConfig.NanoCpus===500000000);
  const drop=array(hostConfig.CapDrop);
  insist(drop.length===1&&drop[0].toUpperCase()==='ALL');
  insist(hostConfig.CapAdd===null||array(hostConfig.CapAdd).length===0);
  insist(array(hostConfig.SecurityOpt).some(x=>
    x==='no-new-privileges:true'||x==='no-new-privileges'));
}
export function reviewRunningPrivateStagingContainer({
  inspect,projectRoot,expectedImage,expectedAuthPath
}={}){
  insist(plain(inspect)&&plain(inspect.State)&&
    plain(inspect.Config)&&plain(inspect.HostConfig)&&
    plain(inspect.NetworkSettings)&&
    cleanPath(projectRoot)&&cleanPath(expectedAuthPath)&&
    !expectedAuthPath.startsWith(projectRoot+'/'));
  reviewPrivateStagingImage(expectedImage);
  const state=inspect.State,config=inspect.Config;
  const host=inspect.HostConfig,net=inspect.NetworkSettings;
  const labels=config.Labels;
  const project=labels?.['com.docker.compose.project'];
  insist(state.Running===true&&state.Status==='running'&&
    state.Paused===false&&state.Restarting===false&&
    state.Dead===false&&
    config.Image===expectedImage&&config.User==='101:101'&&
    validProject(project)&&
    labels['com.docker.compose.service']==='static-review'&&
    labels['com.docker.compose.oneoff']==='False'&&
    labels['com.docker.compose.project.working_dir']===projectRoot&&
    labels['com.docker.compose.project.config_files']===
      resolve(projectRoot,'ops/staging/compose.yaml'));
  insist(Array.isArray(config.Env)&&config.Env.includes('TZ=UTC')&&
    !config.Env.some(x=>typeof x!=='string'||/^(?:IMAGINE_|AWS_|DATABASE_URL=|SECRET=|TOKEN=)/.test(x)));
  approvedLimits(host);
  boundPort(host,net);
  approvedMounts(inspect.Mounts,projectRoot,expectedAuthPath);
  approvedNetwork(inspect,host,project);
  return Object.freeze({
    schema:'imagine.comercial.running-container-review.v1',
    status:'RUNNING_CONTAINER_INSPECT_FIELDS_MATCH_REVIEW_ONLY',
    dockerDaemonStateObserved:true,
    runningUnprivilegedContainerObserved:true,
    actualLoopbackPortBindingReported:true,
    threeReadonlyMountsReported:true,
    constrainedDockerPrivilegesReported:true,
    networkIsolationIndependentlyVerified:false,
    externalTlsAndSshVerified:false,
    actualNginxConfigurationAndHttpVerified:false,
    imageProvenanceIndependentlyVerified:false,
    independentWitnessApproved:false,
    productionAuthorized:false,
    canCollectLeads:false,
    deploymentPerformed:false
  });
}
