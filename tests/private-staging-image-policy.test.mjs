import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {reviewPrivateStagingImage as review}
  from '../src/lib/private-staging-image-policy.mjs';

const synthetic='nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32));

test('F164 accepts only syntactically pinned unprivileged image without granting trust',()=>{
  const result=review(synthetic);
  assert.equal(result.immutableDigestSyntax,true);
  assert.equal(result.imageProvenanceIndependentlyVerified,false);
  assert.equal(result.imageSignatureIndependentlyVerified,false);
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(result.deploymentPerformed,false);
  assert.ok(Object.isFrozen(result));
  assert.doesNotMatch(JSON.stringify(result),/nginxinc|abababab/);
});
test('F164 rejects tags, different repositories, fake digests and whitespace injection',()=>{
  for(const input of [
    'nginx:stable-alpine',
    'nginxinc/nginx-unprivileged:latest',
    'nginxinc/nginx-unprivileged:1.27-alpine',
    'my-registry/nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32)),
    'nginxinc/nginx-unprivileged@sha256:'+('0'.repeat(64)),
    'nginxinc/nginx-unprivileged@sha256:'+('a'.repeat(64)),
    'nginxinc/nginx-unprivileged@sha256:'+('AB'.repeat(32)),
    'nginxinc/nginx-unprivileged@sha256:short',
    synthetic+'\n IMAGINE_PRIVATE_STAGING_REVIEW=1',
    ' nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32)),
    null,undefined,{},['nginx:latest']
  ])assert.throws(()=>review(input),/F164/);
});
test('F164 CLI never launches Docker or exposes untrusted image env values',()=>{
  const source=readFileSync(
    new URL('../scripts/check-private-staging-prerequisites.mjs',import.meta.url),'utf8');
  assert.match(source,/reviewPrivateStagingImage\(process\.env\.IMAGINE_STAGING_NGINX_IMAGE\)/);
  assert.match(source,/IMAGINE_PRIVATE_STAGING_REVIEW/);
  assert.match(source,/existsSync\('dist\/_redirects'\)/);
  assert.match(source,/existsSync\('dist\/_headers'\)/);
  assert.doesNotMatch(source,/execFile|spawnSync|docker (?:compose|run)|fetch\s*\(/);
  const script=new URL('../scripts/check-private-staging-prerequisites.mjs',import.meta.url);
  const output=spawnSync(process.execPath,[script.pathname],{
    encoding:'utf8',
    env:{...process.env,IMAGINE_PRIVATE_STAGING_REVIEW:'0',
      IMAGINE_STAGING_NGINX_IMAGE:'PERSON-SECRET-UNTRUSTED-IMAGE'},
    timeout:15000
  });
  assert.equal(output.status,2);
  assert.match(output.stderr,/not verified \(HOLD\)/);
  assert.doesNotMatch(output.stdout+output.stderr,/PERSON-SECRET-UNTRUSTED-IMAGE/);
});
