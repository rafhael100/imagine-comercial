import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,symlink,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewPrivateStagingHtpasswd as inspect}
  from '../src/lib/private-staging-htpasswd-review.mjs';

const exampleHash='$2y$12$'+('Ab3/'.repeat(13))+'Q';
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'imagine-f166-'));
  const file=join(root,'.htpasswd');
  await writeFile(file,'reviewer:'+exampleHash+'\n',{mode:0o600});
  return {root,file};
}

test('F166 private bcrypt htpasswd file is syntactically checked and never disclosed',async()=>{
  const f=await fixture();
  try{
    const result=inspect(f.file);
    assert.equal(result.fixedReviewerLogin,true);
    assert.equal(result.bcryptHashSyntaxPresent,true);
    assert.equal(result.filePermissionsPrivate,true);
    for(const key of ['mfaVerified','tlsOrSshTunnelVerified',
      'uid101ReadabilityVerified','deploymentAuthorized','deploymentPerformed'])
      assert.equal(result[key],false);
    assert.equal(JSON.stringify(result).includes(exampleHash),false);
    assert.equal(JSON.stringify(result).includes(f.file),false);
    assert.ok(Object.isFrozen(result));
  }finally{await rm(f.root,{recursive:true,force:true});}
});
test('F166 denies world-readable, group writable, symlink and plain-text secrets',async()=>{
  const f=await fixture();
  try{
    await chmod(f.file,0o644);
    assert.throws(()=>inspect(f.file),/not private and regular/);
    await chmod(f.file,0o620);
    assert.throws(()=>inspect(f.file),/not private and regular/);
    await chmod(f.file,0o600);
    const link=join(f.root,'alias');
    await symlink(f.file,link);
    assert.throws(()=>inspect(link),/not private and regular/);
    await writeFile(f.file,'reviewer:PlainTextPasswordNeverAllowed\n');
    assert.throws(()=>inspect(f.file),/not private and regular|bcrypt htpasswd syntax/);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
test('F166 file paths reject traversal, injection, relative paths and missing files',async()=>{
  const f=await fixture();
  try{
    for(const path of [undefined,null,42,{},'relative/.htpasswd',
      '/tmp/../etc/passwd','/tmp//file','/tmp/file:secret',
      '/tmp/secret\nPASSWORD=VALUE']){
      assert.throws(()=>inspect(path),/F166/);
    }
    assert.throws(()=>inspect('/tmp/never-exists-imagine-f166-reviewer'),/ENOENT/);
  }finally{await rm(f.root,{recursive:true,force:true});}
});
test('F166 staging container requires private htpasswd and enables Basic authentication',()=>{
  const compose=readFileSync(new URL('../ops/staging/compose.yaml',import.meta.url),'utf8');
  const nginx=readFileSync(new URL('../ops/staging/nginx.conf',import.meta.url),'utf8');
  const preflight=readFileSync(
    new URL('../scripts/check-private-staging-prerequisites.mjs',import.meta.url),'utf8');
  assert.match(compose,/IMAGINE_STAGING_HTPASSWD_PATH:\?/);
  assert.match(compose,/\/etc\/nginx\/auth\/\.htpasswd:ro/);
  assert.match(compose,/127\.0\.0\.1:4321:8080/);
  assert.match(compose,/read_only: true/);
  assert.match(nginx,/auth_basic "Imagine private review";/);
  assert.match(nginx,/auth_basic_user_file \/etc\/nginx\/auth\/\.htpasswd;/);
  assert.match(nginx,/add_header X-Robots-Tag "noindex, nofollow, noarchive" always;/);
  assert.match(preflight,/reviewPrivateStagingHtpasswd\(process\.env\.IMAGINE_STAGING_HTPASSWD_PATH\)/);
  assert.doesNotMatch(compose+nginx,/\$2y\$12\$|password=|Bearer [A-Za-z]/);
});
test('F166 operator HTTP CLI refuses missing secret without printing its value',()=>{
  const script=new URL('../scripts/review-private-staging-http.mjs',import.meta.url);
  const secret='SYNTHETIC_PERSONAL_SECRET_93';
  const result=spawnSync(process.execPath,[script.pathname,'--port=4321'],{
    encoding:'utf8',timeout:15000,
    env:{...process.env,IMAGINE_PRIVATE_STAGING_REVIEW:'1',
      IMAGINE_STAGING_REVIEW_PASSWORD:''}
  });
  assert.equal(result.status,2);
  assert.match(result.stderr,/not verified \(HOLD\)/);
  assert.doesNotMatch(result.stdout+result.stderr,new RegExp(secret));
});
