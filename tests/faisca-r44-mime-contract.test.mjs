import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('R44 Nginx static review explicitly declares browser-safe MIME types',async()=>{
  const nginx=await read('../ops/faisca/staging/nginx.conf');
  assert.equal(nginx.split('include /etc/nginx/mime.types;').length-1,1);
  assert.equal(nginx.split('default_type application/octet-stream;').length-1,1);
  assert.match(nginx,/map \$request_uri \$faisca_review_frame \{/);
  assert.match(nginx,/map \$request_uri \$faisca_review_ancestors \{/);
  assert.match(nginx,/auth_basic_user_file \/etc\/nginx\/auth\/\.htpasswd;/);
  assert.match(nginx,/connect-src 'none'/);
  assert.match(nginx,/form-action 'none'/);
});

test('R44 live HTTP test matches both SHA256 bytes and effective MIME for all site files',async()=>{
  const source=await read('../ops/faisca/staging/check-nginx-loopback.py');
  for(const item of [
    "'.html': ('text/html',)",
    "'.js': ('application/javascript', 'text/javascript')",
    "'.css': ('text/css',)",
    "'.txt': ('text/plain',)",
    "'.xml': ('application/xml', 'text/xml')",
    "'.png': ('image/png',)",
    "hashlib.sha256(data).hexdigest() != file['sha256']",
    "response_headers.get_content_type() not in allowed_mime"
  ]) assert.ok(source.includes(item),'Missing MIME or integrity check: '+item);
  assert.ok(!source.includes('https://'));
  assert.match(source,/127\.0\.0\.1/);
});
