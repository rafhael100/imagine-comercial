#!/usr/bin/env node
/**
 * F255 — REAL Docker Compose parser, SYNTHETIC CI-only config model.
 * This runs 'docker compose config --format json', NEVER up/run/pull.
 * No image downloads, Docker Engine mutation, private paths or credentials.
 */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {reviewEffectivePrivateStagingCompose}
  from '../src/lib/effective-staging-compose-review.mjs';

const image='nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32));
const authPath='/tmp/imagine-f255-synthetic-review-htpasswd';
const forbidden=['IMAGINE_STAGING_REVIEW_PASSWORD','IMAGINE_STAGING_NGINX_IMAGE',
  'IMAGINE_STAGING_HTPASSWD_PATH','IMAGINE_EXPECTED_STAGING_TREE_SHA256'];
let safeDiagnostic={stage:'preflight'};
try{
  if(process.env.GITHUB_ACTIONS!=='true'||process.argv.length!==2||
     forbidden.some(k=>process.env[k]!==undefined))
    throw Error('F255: synthetic CI-only');
  const run=spawnSync('docker',[
    'compose','-f','ops/staging/compose.yaml','config','--format','json'
  ],{
    cwd:resolve('.'),encoding:'utf8',timeout:20000,maxBuffer:256*1024,
    env:{...process.env,IMAGINE_STAGING_NGINX_IMAGE:image,
      IMAGINE_STAGING_HTPASSWD_PATH:authPath}
  });
  safeDiagnostic={stage:'docker-compose-config',exitOk:!run.error&&run.status===0,
    stdoutPresent:!!run.stdout,stdoutInBounds:(run.stdout?.length??0)<=65536};
  if(run.error||run.status!==0||!run.stdout||run.stdout.length>65536)
    throw Error('F255: Docker Compose parser did not produce bounded JSON');
  const document=JSON.parse(run.stdout);
  const service=document?.services?.['static-review']??{};
  const volumes=Array.isArray(service.volumes)?service.volumes:[];
  const ports=Array.isArray(service.ports)?service.ports:[];
  safeDiagnostic={stage:'effective-review',
    topLevelFieldCount:Object.keys(document??{}).length,
    serviceFieldCount:Object.keys(service).length,
    // Field NAMES are from an entirely synthetic, source-locked model.
    // Only fixed-schema identifiers can be displayed; never values.
    serviceFieldNames:Object.keys(service).sort().map(k=>
      /^[a-z_]{1,40}$/.test(k)?k:'UNRECOGNIZED_FIELD_NAME'),
    tmpfsKinds:Array.isArray(service.tmpfs)?service.tmpfs.map(v=>
      typeof v==='string'?'string':Array.isArray(v)?'array':
        (v===null?'null':typeof v)) :[],
    tmpfsFieldNames:Array.isArray(service.tmpfs)?service.tmpfs.map(v=>
      v!==null&&typeof v==='object'&&!Array.isArray(v)?
        Object.keys(v).sort().map(k=>/^[a-z_]{1,40}$/.test(k)?k:'UNRECOGNIZED_FIELD_NAME'):[]) :[],
    portsCount:ports.length,portHasLoopback:ports[0]?.host_ip==='127.0.0.1',
    serviceReadonly:service.read_only===true,
    volumeCount:volumes.length,
    mountReadonlyFlags:volumes.map(v=>v.read_only===true),
    volumeBindingFlags:volumes.map(v=>v.type==='bind'),
    mountTargetsMatch:volumes.map(v=>[
      '/usr/share/nginx/html','/etc/nginx/conf.d/default.conf',
      '/etc/nginx/auth/.htpasswd'].includes(v.target)),
    hasUser:service.user==='101:101',
    capDropAll:service.cap_drop?.length===1&&service.cap_drop[0]==='ALL',
    hasNoNewPrivileges:service.security_opt?.includes('no-new-privileges:true')===true,
    imageMatches:service.image===image,hostNetworkPresent:service.network_mode!==undefined,
    memLimitType:typeof service.mem_limit,
    tmpfsType:typeof service.tmpfs,
    tmpfsCount:Array.isArray(service.tmpfs)?service.tmpfs.length:-1,
    hasDefaultNetwork:document?.networks?.default!==undefined,
    commandEmpty:service.command===null||service.command===undefined||
      Array.isArray(service.command)&&service.command.length===0,
    entrypointEmpty:service.entrypoint===null||service.entrypoint===undefined||
      Array.isArray(service.entrypoint)&&service.entrypoint.length===0,
    restartNo:service.restart==='no',
    pids64:service.pids_limit===64,
    memLimitExpected:service.mem_limit==='256m'||service.mem_limit===268435456,
    cpusHalf:service.cpus===0.5||service.cpus==='0.5',
    environmentOnlyTZ:service.environment?.TZ==='UTC'&&
      Object.keys(service.environment??{}).length===1,
    tmpfsMatch:JSON.stringify(service.tmpfs)===JSON.stringify([
      '/tmp:rw,noexec,nosuid,size=32m',
      '/var/run:rw,noexec,nosuid,size=4m']),
    serviceNetworkIsDefault:JSON.stringify(service.networks)==='{"default":null}'||
      JSON.stringify(service.networks)==='["default"]',
    rootNetworkSingleDefault:Object.keys(document.networks??{}).length===1,
    rootDefaultNetworkOnlyName:Object.keys(document.networks?.default??{})
      .every(k=>k==='name'),
    firstMountCorrect:volumes.some(v=>v.target==='/usr/share/nginx/html'&&
      v.source===resolve('dist')),
    secondMountCorrect:volumes.some(v=>v.target==='/etc/nginx/conf.d/default.conf'&&
      v.source===resolve('ops/staging/nginx.conf')),
    thirdMountCorrect:volumes.some(v=>v.target==='/etc/nginx/auth/.htpasswd'&&
      v.source===authPath),
    volumeBindMetadataOnlyCreateHostPath:volumes.every(v=>
      !v.bind||Object.keys(v.bind).every(k=>k==='create_host_path'))
  };
  const review=reviewEffectivePrivateStagingCompose(document,{
    projectRoot:resolve('.'),expectedImage:image,expectedAuthPath:authPath
  });
  if(review.status!=='RESOLVED_CONFIG_MODEL_REVIEW_ONLY'||
     review.localLoopbackPort!==true||
     review.allThreeMountsReadOnly!==true||
     review.actualDockerContainerInspected!==false||
     review.deploymentAuthorized!==false)
    throw Error('F255: misleading effective Compose review');
  console.log(JSON.stringify({
    schema:'imagine.comercial.real-docker-compose-json-ci.v1',
    status:'SYNTHETIC_DOCKER_COMPOSE_PARSER_REVIEW_PASSED',
    dockerComposeParserUsed:true,
    actualDockerEngineUsed:false,
    imageDownloaded:false,
    operatorOrPrivateDataUsed:false,
    actualLeasewebVerified:false,
    deploymentAuthorized:false
  }));
}catch{
  // Never echo raw resolved JSON: it may include host paths.
  console.error('F255: Docker Compose parser/effective model contract failed (NO-GO)');
  // Only fixed boolean/number/type diagnostics: NO raw keys, values, digests,
  // paths, image refs, env, volumes or resolved JSON in a public runner log.
  if(process.env.GITHUB_ACTIONS==='true')
    console.error('F255_SAFE_SHAPE '+JSON.stringify(safeDiagnostic));
  process.exitCode=1;
}
