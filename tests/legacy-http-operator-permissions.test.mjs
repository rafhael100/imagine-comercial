import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chmodSync,linkSync,mkdtempSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

const compare=fileURLToPath(new URL('../scripts/review-legacy-http-operator.mjs',import.meta.url));
const genericHold='F-LEGACY-HTTP: private continuity evidence unavailable (HOLD)\n';
const payload=scope=>JSON.stringify({
 schema:'imagine.comercial.legacy-http-snapshot.v1',scope,
 rows:legacyUrls.map(({from:path})=>({
  path,status:200,mime:'text/html',bytes:100,redirectTo:null,
  bodySha256:createHash('sha256').update('SYNTHETIC_PRIVATE_REVIEW:'+path).digest('hex')
 }))
});
function withSnapshots(run){
 const dir=mkdtempSync(join(tmpdir(),'imagine-f310-private-permissions-'));
 const before=join(dir,'before.json'),after=join(dir,'after.json');
 writeFileSync(before,payload('BEFORE_ORIGINAL'),{mode:0o600});
 writeFileSync(after,payload('AFTER_CANDIDATE'),{mode:0o600});
 try{return run({dir,before,after});}
 finally{rmSync(dir,{recursive:true,force:true});}
}
function invoke(before,after){
 const result=spawnSync(process.execPath,[compare,'--before',before,'--after',after],{
  cwd:tmpdir(),encoding:'utf8',timeout:10000,
  env:{...process.env,GITHUB_ACTIONS:'false',IMAGINE_LEGACY_HTTP_REVIEW:'1'}
 });
 assert.ifError(result.error);
 return result;
}
function hold(result){
 assert.equal(result.status,2);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr,genericHold);
 assert.doesNotMatch(result.stderr,/before\.json|after\.json|imagine-f310|SYNTHETIC_PRIVATE_REVIEW/);
}
test('F310 compare accepts only private snapshots and never authorizes cutover',()=>withSnapshots(({before,after})=>{
 const r=invoke(before,after);
 assert.equal(r.status,0,r.stderr);
 const result=JSON.parse(r.stdout);
 assert.equal(result.heldPreservedExact,22);
 assert.equal(result.allHeldBytePreserved,true);
 assert.equal(result.status,'NO_GO_OPERATOR_HTTP_EVIDENCE_REVIEW_ONLY');
 assert.equal(result.redirectsAuthorized,0);
}));
for(const [fileKey,mode] of [['before',0o644],['after',0o640],['before',0o400],['after',0o660]]){
 test('F310 comparison refuses a '+fileKey+' snapshot with mode '+mode.toString(8),()=>withSnapshots(x=>{
  chmodSync(x[fileKey],mode);
  hold(invoke(x.before,x.after));
 }));
}
test('F310 comparison refuses world-traversable snapshot parent',()=>withSnapshots(x=>{
 chmodSync(x.dir,0o755);
 hold(invoke(x.before,x.after));
}));
test('F310 comparison refuses a hardlinked snapshot inode',()=>withSnapshots(x=>{
 linkSync(x.before,join(x.dir,'another-link.json'));
 hold(invoke(x.before,x.after));
}));
test('F310 comparison refuses a final-component symlink',()=>withSnapshots(x=>{
 const alias=join(x.dir,'linked.json');
 symlinkSync(x.before,alias);
 hold(invoke(alias,x.after));
}));
test('F310 comparison refuses invalid UTF-8 evidence',()=>withSnapshots(x=>{
 writeFileSync(x.after,Buffer.from([0xff,0xfe]));
 hold(invoke(x.before,x.after));
}));
