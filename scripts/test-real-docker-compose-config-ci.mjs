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
  if(run.error||run.status!==0||!run.stdout||run.stdout.length>65536)
    throw Error('F255: Docker Compose parser did not produce bounded JSON');
  const document=JSON.parse(run.stdout);
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
  process.exitCode=1;
}
