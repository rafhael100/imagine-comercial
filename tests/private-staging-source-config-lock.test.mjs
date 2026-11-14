import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {reviewPrivateStagingConfiguration as review}
  from '../src/lib/private-staging-config-lock.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compose=read('ops/staging/compose.yaml');
const nginx=read('ops/staging/nginx.conf');
const baseline=()=>({compose,nginx});
const safeSecret='PRIVATE_STAGING_OPERATOR_SECRET_DO_NOT_LOG_F253';

test('F253 approved exact Compose/Nginx source is recognized but NEVER authorizes operation',()=>{
  const report=review(baseline());
  assert.equal(report.status,'REVIEWED_SOURCE_CONFIG_MATCH_ONLY');
  for(const k of ['localhostPortBindingPresent','readonlyUnprivilegedContainerPresent',
    'authenticatedNoindexNginxSourcePresent'])
    assert.equal(report[k],true,k);
  for(const k of ['runtimeComposeConfigVerified','actualNetworkExposureVerified',
    'imageProvenanceVerified','actualNginxRuntimeVerified',
    'independentOperatorApprovalPresent','canPublish','deploymentAuthorized',
    'deploymentPerformed'])
    assert.equal(report[k],false,k);
  assert.equal(report.extraComposeOrNginxDirectivesAccepted,false);
  assert.ok(Object.isFrozen(report));
  assert.doesNotMatch(JSON.stringify(report),/127\.0\.0\.1:4321|nginxinc|\/etc\/nginx|PRIVATE_/);
});
test('F253 no bypass through extra YAML services, public bind, elevated container or volume writes',()=>{
  const attacks=[
    text=>text.replace('127.0.0.1:4321:8080','0.0.0.0:4321:8080'),
    text=>text.replace('127.0.0.1:4321:8080','4321:8080'),
    text=>text.replace('    read_only: true','    read_only: false'),
    text=>text.replace('user: "101:101"','user: "0:0"'),
    text=>text.replace('    cap_drop:\n      - ALL','    cap_add:\n      - NET_ADMIN'),
    text=>text.replace('no-new-privileges:true','no-new-privileges:false'),
    text=>text.replace('    restart: "no"','    restart: "always"'),
    text=>text.replace('../../dist:/usr/share/nginx/html:ro','../../dist:/usr/share/nginx/html:rw'),
    text=>text.replace('    ports:', '    ports:\n      - "0.0.0.0:9000:8080"'),
    text=>text+'\n  public-exposure:\n    image: nginx:latest\n    ports:\n      - "0.0.0.0:80:80"\n',
    text=>text.replace('image: ${IMAGINE_STAGING_NGINX_IMAGE:?',
      'image: nginx:latest # ${IMAGINE_STAGING_NGINX_IMAGE:?')
  ];
  for(const attack of attacks){
    const modified=attack(compose);
    assert.notEqual(modified,compose);
    assert.throws(()=>review({compose:modified,nginx}),/F253.*HOLD/,modified.slice(0,100));
  }
});
test('F253 rejects auth bypass, public index, new paths, proxy, POST and access logging',()=>{
  const attacks=[
    text=>text.replace('auth_basic "Imagine private review";','auth_basic off;'),
    text=>text.replace('auth_basic_user_file /etc/nginx/auth/.htpasswd;',''),
    text=>text.replace('noindex, nofollow, noarchive','index, follow'),
    text=>text.replace('Cache-Control "no-store"','Cache-Control "public, max-age=3600"'),
    text=>text.replace('limit_except GET HEAD','limit_except GET HEAD POST'),
    text=>text.replace('access_log off;','access_log /var/log/nginx/access.log;'),
    text=>text.replace('location / {','location = /robots.txt { auth_basic off; }\n    location / {'),
    text=>text.replace('location / {','location /api { proxy_pass http://localhost:8989; }\n    location / {'),
    text=>text.replace('autoindex off;','autoindex on;'),
    text=>text.replace('error_page 404 /404.html;','error_page 404 =200 /404.html;'),
    text=>text+'\nserver { listen 8090; auth_basic off; }\n'
  ];
  for(const attack of attacks){
    const modified=attack(nginx);
    assert.notEqual(modified,nginx);
    assert.throws(()=>review({compose,nginx:modified}),/F253.*HOLD/);
  }
});
test('F253 config lock fails closed on malformed, binary, unicode or oversized documents',()=>{
  for(const invalid of [undefined,null,{},[],'',String.fromCharCode(0),
    compose.replace(/\n/g,'\r\n'),compose+'\t',compose+'é',
    compose+'X'.repeat(20000)]){
    assert.throws(()=>review({compose:invalid,nginx}),/F253.*HOLD/);
  }
  assert.throws(()=>review(),/F253.*HOLD/);
});
test('F253 harmless comment-only edits are tolerated but executable extra lines are not',()=>{
  const comments=compose+'\n# F253 harmless documentation comment\n';
  const ngComments=nginx+'\n# NO-GO explanatory comment\n';
  assert.equal(review({compose:comments,nginx:ngComments}).deploymentAuthorized,false);
  assert.throws(()=>review({compose:comments+'    privileged: true\n',nginx:ngComments}),/HOLD/);
});
test('F253 both private review CLI paths enforce the source policy without leaking secrets',()=>{
  for(const p of ['scripts/check-private-staging-prerequisites.mjs',
    'scripts/review-private-staging-operator.mjs']){
    const src=read(p);
    assert.match(src,/reviewPrivateStagingConfiguration\(/);
    assert.match(src,/readApprovedFile\('ops\/staging\/compose.yaml'/);
    assert.match(src,/readApprovedFile\('ops\/staging\/nginx.conf'/);
  }
  const cli=new URL('../scripts/check-reviewed-staging-config.mjs',import.meta.url);
  const ok=spawnSync(process.execPath,[cli.pathname],{encoding:'utf8',
    timeout:15000,cwd:new URL('..',import.meta.url),
    env:{...process.env,IMAGINE_STAGING_REVIEW_PASSWORD:safeSecret}});
  assert.equal(ok.status,0,ok.stderr);
  assert.equal(JSON.parse(ok.stdout).deploymentAuthorized,false);
  assert.equal(ok.stderr,'');
  const bad=spawnSync(process.execPath,[cli.pathname,'--unsafe'],{encoding:'utf8',
    timeout:15000,cwd:new URL('..',import.meta.url),
    env:{...process.env,IMAGINE_STAGING_REVIEW_PASSWORD:safeSecret}});
  assert.equal(bad.status,2);
  assert.match(bad.stderr,/not verified \(HOLD\)/);
  assert.equal(bad.stdout,'');
  assert.doesNotMatch(ok.stdout+ok.stderr+bad.stdout+bad.stderr,new RegExp(safeSecret));
});
