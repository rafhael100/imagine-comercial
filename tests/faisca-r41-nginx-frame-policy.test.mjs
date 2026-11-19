import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyPrivateStagingKit } from '../ops/faisca/staging/verify-kit.mjs';

const read = file => readFile(new URL(file,import.meta.url),'utf8');

test('R41 private iframe frame policy is evaluated on original URI, not rewritten $uri',async()=>{
  const nginx=await read('../ops/faisca/staging/nginx.conf');
  assert.equal((nginx.match(/map \$request_uri \$faisca_review_(?:frame|ancestors) \{/g)||[]).length,2);
  assert.equal((nginx.match(/map \$uri \$faisca_review_/g)||[]).length,0);
  assert.match(nginx,/~\^\/__faisca_preview\/\(journey\|support\)\/\$ SAMEORIGIN;/);
  assert.match(nginx,/~\^\/__faisca_preview\/\(journey\|support\)\/\$ "'self'";/);
  assert.match(nginx,/add_header X-Frame-Options \$faisca_review_frame always;/);
  assert.match(nginx,/add_header Content-Security-Policy "[^"]*frame-ancestors \$faisca_review_ancestors" always;/);
  assert.match(nginx,/try_files \$uri \$uri\/ \$uri\/index\.html =404;/);
  assert.match(nginx,/auth_basic_user_file \/etc\/nginx\/auth\/\.htpasswd;/);
  assert.match(nginx,/limit_except GET HEAD \{ deny all; \}/);
  assert.match(nginx,/connect-src 'none'/);
  assert.match(nginx,/form-action 'none'/);
});

test('R41 staging configuration source stays loopback, no deployment authority',async()=>{
  const compose=await read('../ops/faisca/staging/compose.yaml');
  assert.match(compose,/127\.0\.0\.1:4337:8080/);
  assert.match(compose,/read_only: true/);
  assert.match(compose,/no-new-privileges:true/);
  assert.match(compose,/IMAGINE_FAISCA_STAGING_HTPASSWD_PATH/);
  assert.match(compose,/IMAGINE_FAISCA_NGINX_IMAGE/);
  assert.doesNotMatch(compose,/0\.0\.0\.0:4337:8080/);
  assert.equal(typeof verifyPrivateStagingKit,'function');
  const mascot=await readFile(new URL('../ops/faisca/assets/faisca-master.png',import.meta.url));
  assert.equal(createHash('sha256').update(mascot).digest('hex'),
    '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d');
});
