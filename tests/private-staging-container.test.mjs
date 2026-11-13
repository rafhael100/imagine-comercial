import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compose=read('ops/staging/compose.yaml');
const nginx=read('ops/staging/nginx.conf');

test('F163 staging compose is private, read-only, unprivileged and digest-gated',()=>{
  assert.match(compose,/image: \$\{IMAGINE_STAGING_NGINX_IMAGE:\?/);
  assert.match(compose,/127\.0\.0\.1:4321:8080/);
  assert.match(compose,/user: "101:101"/);
  assert.match(compose,/read_only: true/);
  assert.match(compose,/cap_drop:\s*\n\s*- ALL/);
  assert.match(compose,/no-new-privileges:true/);
  assert.match(compose,/pids_limit: 64/);
  assert.match(compose,/mem_limit: 256m/);
  assert.match(compose,/\.\/\.\.\/dist:\/usr\/share\/nginx\/html:ro|\.\.\/\.\.\/dist:\/usr\/share\/nginx\/html:ro/);
  assert.match(compose,/nginx\.conf:\/etc\/nginx\/conf\.d\/default\.conf:ro/);
  assert.doesNotMatch(compose,/network_mode:\s*host|privileged:\s*true|:80\b|0\.0\.0\.0:/);
});
test('F163 Nginx serves only static assets, guards 404 and forbids POST',()=>{
  assert.match(nginx,/listen 8080 default_server;/);
  assert.match(nginx,/root \/usr\/share\/nginx\/html;/);
  assert.match(nginx,/error_page 404 \/404\.html;/);
  assert.match(nginx,/location = \/404\.html/);
  assert.match(nginx,/autoindex off;/);
  assert.match(nginx,/access_log off;/);
  assert.match(nginx,/limit_except GET HEAD \{ deny all; \}/);
  assert.match(nginx,/try_files \$uri \$uri\/ \$uri\/index\.html =404;/);
  assert.match(nginx,/add_header X-Content-Type-Options "nosniff" always;/);
  assert.match(nginx,/add_header X-Frame-Options "DENY" always;/);
  assert.match(nginx,/add_header X-Robots-Tag "noindex, nofollow, noarchive" always;/);
  assert.match(nginx,/add_header Cache-Control "no-store" always;/);
  assert.match(nginx,/add_header Referrer-Policy "strict-origin-when-cross-origin" always;/);
  assert.match(nginx,/add_header Permissions-Policy "camera=\(\), microphone=\(\), geolocation=\(\)" always;/);
  assert.doesNotMatch(nginx,/proxy_pass|return 301|return 302|autoindex on|access_log\s+\/var/i);
});
