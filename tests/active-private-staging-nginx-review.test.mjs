import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {reviewActivePrivateStagingNginx as review}
  from '../src/lib/active-private-staging-nginx-review.mjs';

const trusted=readFileSync(new URL('../ops/staging/nginx.conf',import.meta.url),'utf8');
const marker=path=>'# configuration file '+path+':\n';
const main='worker_processes auto;\nevents { worker_connections 1024; }\n'+
  'http { include /etc/nginx/mime.types; include /etc/nginx/conf.d/*.conf; }\n';
const mime='types { text/html html htm; text/css css; application/javascript js; }\n';
function fixture({source=trusted,head=main,types=mime,extra=''}={}){
  return marker('/etc/nginx/nginx.conf')+head+
    marker('/etc/nginx/mime.types')+types+
    extra+
    marker('/etc/nginx/conf.d/default.conf')+source;
}
const call=(dump,source=trusted)=>review({dump,reviewedNginxSource:source});
test('F257 Nginx -T source matching is a read-only diagnosis, never production approval',()=>{
  const report=call(fixture());
  assert.equal(report.status,'LOADED_NGINX_CONFIG_EQUALS_REVIEWED_SOURCE_ONLY');
  for(const key of ['expectedStaticConfigLoaded',
    'unapprovedAdditionalConfigFileAbsent','duplicateServerBlockAbsent'])
    assert.equal(report[key],true,key);
  for(const key of ['browserOrHttpStatusVerified',
    'actualPublicNetworkIsolationVerified','sslAndSshVerified',
    'independentOperatorApprovalPresent','deployAuthorized','deployedByThisCheck'])
    assert.equal(report[key],false,key);
  assert.ok(Object.isFrozen(report));
  for(const phrase of ['/etc/nginx','auth_basic','server_name','127.0.0.1'])
    assert.equal(JSON.stringify(report).includes(phrase),false);
});
test('F257 changes to active BasicAuth/noindex/cache/locations are detected despite source remaining approved',()=>{
  const attacks=[
    t=>t.replace('auth_basic "Imagine private review";','auth_basic off;'),
    t=>t.replace('auth_basic_user_file /etc/nginx/auth/.htpasswd;',''),
    t=>t.replace('X-Robots-Tag "noindex, nofollow, noarchive"','X-Robots-Tag "index, follow"'),
    t=>t.replace('Cache-Control "no-store"','Cache-Control "public, max-age=86400"'),
    t=>t.replace('limit_except GET HEAD','limit_except GET HEAD POST'),
    t=>t.replace('listen 8080 default_server;','listen 8080;\n    listen 8888;'),
    t=>t.replace('location / {','location = /robots.txt { auth_basic off; }\n    location / {'),
    t=>t.replace('autoindex off;','autoindex on;'),
    t=>t.replace('access_log off;','access_log /var/log/nginx/access.log;'),
    t=>t+'\nserver { listen 8090; auth_basic off; }\n',
    t=>t.replace('try_files $uri $uri/ $uri/index.html =404;',
      'proxy_pass http://insecure.example;')
  ];
  for(const change of attacks){
    const corrupted=change(trusted);
    assert.notEqual(corrupted,trusted);
    assert.throws(()=>call(fixture({source:corrupted})),/F257/);
  }
});
test('F257 refuses additional server, proxy or included config from base image',()=>{
  assert.throws(()=>call(fixture({
    head:main+'server { listen 80; }\n'})),/F257/);
  assert.throws(()=>call(fixture({
    head:main+'location /api { proxy_pass http://untrusted.example; }\n'})),/F257/);
  assert.throws(()=>call(fixture({
    extra:marker('/etc/nginx/conf.d/extra.conf')+
      'server { listen 443; auth_basic off; }\n'
  })),/F257/);
  assert.throws(()=>call(fixture({
    extra:marker('/etc/nginx/sites-enabled/public.conf')+
      'server { listen 443; }\n'
  })),/F257/);
});
test('F257 rejects incomplete/duplicate/malformed/hostile config dumps',()=>{
  for(const dump of [null,{},[],undefined,'',fixture().replace(
    marker('/etc/nginx/conf.d/default.conf'),''),fixture().replace(
    marker('/etc/nginx/mime.types'),''),fixture()+'\0',
    fixture().replace(/\n/g,'\r\n'),fixture()+'Z'.repeat(524289),
    fixture().replace(marker('/etc/nginx/conf.d/default.conf'),
      marker('/etc/nginx/nginx.conf')),
    marker('/etc/nginx/conf.d/default.conf')+trusted]){
    assert.throws(()=>call(dump),/F257/);
  }
});
test('F257 comment edits are harmless; executable changes remain fail-closed',()=>{
  const extra='\n# F257 comment: staging continua privado e sem publicação\n';
  assert.equal(call(fixture({source:trusted+extra})).deployAuthorized,false);
  assert.throws(()=>call(fixture({source:trusted+extra+'location /other { auth_basic off; }'})),/F257/);
});
test('F257 operator CLI only executes read-only config, ps, inspect, nginx -T commands',()=>{
  const cli=new URL('../scripts/check-running-private-nginx.mjs',import.meta.url);
  const source=readFileSync(cli,'utf8');
  for(const phrase of ['reviewPrivateStagingConfiguration(',
    'reviewEffectivePrivateStagingCompose(',
    'reviewRunningPrivateStagingContainer(',
    'reviewActivePrivateStagingNginx(',
    "'config','--format','json'",
    "'ps','-q','static-review'",
    "'inspect','--type','container'",
    "'exec',ids[0],'nginx','-T'"])
    assert.ok(source.includes(phrase),'F257 missing '+phrase);
  assert.doesNotMatch(source,/['"](?:up|run|start|stop|restart|rm|pull|push)['"]/);
  const secret='F257_SECRET_SHOULD_NOT_LOG';
  const blocked=spawnSync(process.execPath,[cli.pathname],{encoding:'utf8',
    timeout:15000,env:{...process.env,GITHUB_ACTIONS:'true',
      IMAGINE_PRIVATE_STAGING_REVIEW:'1',
      IMAGINE_STAGING_REVIEW_PASSWORD:secret}});
  assert.equal(blocked.status,2);
  assert.equal(blocked.stdout,'');
  assert.match(blocked.stderr,/not verified \(HOLD\)/);
  assert.doesNotMatch(blocked.stderr,new RegExp(secret));
});
