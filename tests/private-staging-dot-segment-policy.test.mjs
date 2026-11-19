import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewPrivateStagingConfiguration} from '../src/lib/private-staging-config-lock.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const nginx=read('ops/staging/nginx.conf');
const compose=read('ops/staging/compose.yaml');
const rule=nginx.match(/^\s*location ~ (.+) \{$/m);
if(!rule)throw Error('F302: no active deny regex from staging Nginx');
const blocked=new RegExp(rule[1]);

test('F302 real Nginx deny regex catches root and nested private dot segments',()=>{
  const forbidden=[
    '/.env','/.env.local','/.env.production','/.env.backup',
    '/.git','/.git/config','/.gitignore','/.github/workflows/build.yml',
    '/.htpasswd','/.npmrc','/.well-known/security.txt',
    '/assets/.env','/assets/.env.local','/assets/.git/config',
    '/public/.hidden/file.txt','/_redirects','/_redirects/index.html',
    '/_headers','/_headers/config'
  ];
  for(const path of forbidden)
    assert.equal(blocked.test(path),true,'must refuse '+path);
  const allowed=[
    '/', '/contato/','/robots.txt','/sitemap.xml','/404.html',
    '/servicos/','/conteudos/','/_astro/site.css','/logo-imagine.png'
  ];
  for(const path of allowed)
    assert.equal(blocked.test(path),false,'normal public asset still accessible '+path);
});

test('F302 tightened Nginx rule is exactly the independently pinned configuration',()=>{
  const report=reviewPrivateStagingConfiguration({compose,nginx});
  assert.equal(report.status,'REVIEWED_SOURCE_CONFIG_MATCH_ONLY');
  assert.equal(report.deploymentAuthorized,false);
  assert.equal(report.canPublish,false);
  assert.equal(report.actualNginxRuntimeVerified,false);

  const vulnerable=nginx.replace(rule[1],
    '^/(?:_redirects|_headers|\\.git|\\.env|\\.github)(?:/|$)');
  assert.notEqual(vulnerable,nginx);
  assert.throws(()=>reviewPrivateStagingConfiguration({compose,nginx:vulnerable}),
    /F253: staging configuration differs from reviewed policy/);
  const bypass=nginx.replace(rule[1],
    '(^|/)\\.git|^/(?:_redirects|_headers)(?:/|$)');
  assert.throws(()=>reviewPrivateStagingConfiguration({compose,nginx:bypass}),
    /F253: staging configuration differs from reviewed policy/);
});

test('F302 source remains static, localhost-only and forbids writes',()=>{
  assert.match(nginx,/auth_basic "Imagine private review"/);
  assert.match(nginx,/auth_basic_user_file \/etc\/nginx\/auth\/\.htpasswd/);
  assert.match(nginx,/limit_except GET HEAD \{ deny all; \}/);
  assert.match(nginx,/error_page 404 \/404\.html/);
  assert.match(nginx,/X-Robots-Tag "noindex, nofollow, noarchive"/);
  assert.match(nginx,/Cache-Control "no-store"/);
  assert.match(compose,/127\.0\.0\.1:4321:8080/);
  assert.doesNotMatch(nginx,/proxy_pass|fastcgi_pass|return 301|return 302/);
});
