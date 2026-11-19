import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,symlinkSync,writeFileSync}
 from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const capture=fileURLToPath(new URL('../scripts/capture-legacy-http-operator.mjs',import.meta.url));
const compare=fileURLToPath(new URL('../scripts/review-legacy-http-operator.mjs',import.meta.url));
const captureError='F-LEGACY-CAPTURE: operator evidence collection unavailable (HOLD)\n';
const compareError='F-LEGACY-HTTP: private continuity evidence unavailable (HOLD)\n';

function withDirectories(run){
 const privateDir=mkdtempSync(join(tmpdir(),'imagine-f310-path-test-'));
 const repositoryDir=mkdtempSync(join(root,'f310-synthetic-path-test-'));
 try{return run({privateDir,repositoryDir});}
 finally{
  rmSync(privateDir,{recursive:true,force:true});
  rmSync(repositoryDir,{recursive:true,force:true});
 }
}

function snapshot(scope){
 return {schema:'imagine.comercial.legacy-http-snapshot.v1',scope,
  rows:legacyUrls.map(({from:path})=>({path,status:200,mime:'text/html',
   bodySha256:createHash('sha256').update('SYNTHETIC_BOUNDARY:'+path).digest('hex'),
   bytes:100,redirectTo:null}))};
}
function writeSnapshots(dir){
 const before=join(dir,'before.json'),after=join(dir,'after.json');
 writeFileSync(before,JSON.stringify(snapshot('BEFORE_ORIGINAL')),{mode:0o600});
 writeFileSync(after,JSON.stringify(snapshot('AFTER_CANDIDATE')),{mode:0o600});
 return {before,after};
}
function invoke(script,args,{cwd,trace,afterFirstCall=''}){
 // The CLI is exercised from an unrelated cwd, with no socket or real data.
 // Only a call count is retained. The optional hook changes a synthetic
 // parent-directory alias during collection to check the resolved output.
 const preload=`
  import {writeFileSync,unlinkSync,symlinkSync} from 'node:fs';
  let calls=0;
  globalThis.fetch=async()=>{
   calls++;
   if(calls===1){${afterFirstCall}}
   return new Response('SYNTHETIC_PRIVATE_PATH_BODY',{
    status:200,headers:{'content-type':'text/html'}
   });
  };
  process.on('exit',()=>writeFileSync(${JSON.stringify(trace)},
   JSON.stringify({calls}),{mode:0o600}));
 `;
 const env={...process.env,GITHUB_ACTIONS:'false',IMAGINE_LEGACY_HTTP_REVIEW:'1'};
 delete env.IMAGINE_LEGACY_HTTP_TIMEOUT_MS;
 delete env.IMAGINE_STAGING_REVIEW_PASSWORD;
 const result=spawnSync(process.execPath,[
  '--import','data:text/javascript;base64,'+Buffer.from(preload).toString('base64'),
  script,...args
 ],{cwd,env,encoding:'utf8',timeout:7000});
 assert.ifError(result.error);
 assert.equal(result.signal,null);
 return {...result,...JSON.parse(readFileSync(trace,'utf8'))};
}
function rejected(result,error){
 assert.equal(result.status,2);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr,error);
 assert.equal(result.calls,0);
}

test('F310 capture rejects repository output when invoked from an unrelated working directory',()=>{
 withDirectories(({privateDir,repositoryDir})=>{
  const target=join(repositoryDir,'capture.json');
  const result=invoke(capture,['--original',target],{
   cwd:privateDir,trace:join(privateDir,'trace.json')
  });
  rejected(result,captureError);
  assert.equal(existsSync(target),false);
 });
});

test('F310 capture rejects an external parent alias that points into the repository',()=>{
 withDirectories(({privateDir,repositoryDir})=>{
  const alias=join(privateDir,'repository-alias');
  symlinkSync(repositoryDir,alias,'dir');
  const target=join(alias,'capture.json');
  const result=invoke(capture,['--original',target],{
   cwd:root,trace:join(privateDir,'trace.json')
  });
  rejected(result,captureError);
  assert.equal(existsSync(join(repositoryDir,'capture.json')),false);
 });
});

test('F310 comparison rejects repository inputs independently of the working directory',()=>{
 withDirectories(({privateDir,repositoryDir})=>{
  const {before,after}=writeSnapshots(repositoryDir);
  const result=invoke(compare,['--before',before,'--after',after],{
   cwd:privateDir,trace:join(privateDir,'trace.json')
  });
  rejected(result,compareError);
 });
});

test('F310 capture resolves parent traversal after a directory alias before deciding whether it is external',()=>{
 withDirectories(({privateDir,repositoryDir})=>{
  const nested=join(repositoryDir,'nested');
  mkdirSync(nested);
  const alias=join(privateDir,'repository-alias');
  symlinkSync(nested,alias,'dir');
  const result=invoke(capture,['--original',alias+'/../capture.json'],{
   cwd:privateDir,trace:join(privateDir,'trace.json')
  });
  rejected(result,captureError);
  assert.equal(existsSync(join(repositoryDir,'capture.json')),false);
  assert.equal(existsSync(join(privateDir,'capture.json')),false);
 });
});

test('F310 comparison rejects parent aliases pointing to repository inputs',()=>{
 withDirectories(({privateDir,repositoryDir})=>{
  writeSnapshots(repositoryDir);
  const alias=join(privateDir,'repository-alias');
  symlinkSync(repositoryDir,alias,'dir');
  const result=invoke(compare,['--before',join(alias,'before.json'),
   '--after',join(alias,'after.json')],{
   cwd:root,trace:join(privateDir,'trace.json')
  });
  rejected(result,compareError);
 });
});

test('F310 capture accepts a private directory even when it is the operator working directory',()=>{
 withDirectories(({privateDir})=>{
  const target=join(privateDir,'capture.json');
  const result=invoke(capture,['--original',target],{
   cwd:privateDir,trace:join(privateDir,'trace.json')
  });
  assert.equal(result.status,0);
  assert.equal(result.stderr,'');
  assert.equal(result.calls,27);
  assert.equal(statSync(target).mode&0o777,0o600);
  const observed=JSON.parse(readFileSync(target,'utf8'));
  assert.equal(observed.rows.length,27);
  assert.doesNotMatch(result.stdout,/SYNTHETIC_PRIVATE_PATH_BODY|\/tmp\//);
 });
});

test('F310 comparison accepts private snapshots in the operator working directory',()=>{
 withDirectories(({privateDir})=>{
  const {before,after}=writeSnapshots(privateDir);
  const result=invoke(compare,['--before',before,'--after',after],{
   cwd:privateDir,trace:join(privateDir,'trace.json')
  });
  assert.equal(result.status,0);
  assert.equal(result.stderr,'');
  assert.equal(result.calls,0);
  const review=JSON.parse(result.stdout);
  assert.equal(review.heldPreservedExact,22);
  assert.equal(review.allHeldBytePreserved,true);
  assert.equal(review.newSiteCanReplaceOriginal,false);
  assert.equal(review.redirectsAuthorized,0);
 });
});

test('F310 capture keeps the resolved external destination if its parent alias changes during collection',()=>{
 withDirectories(({privateDir,repositoryDir})=>{
  const alias=join(privateDir,'destination-alias');
  const actual=mkdtempSync(join(privateDir,'external-destination-'));
  symlinkSync(actual,alias,'dir');
  const result=invoke(capture,['--original',join(alias,'capture.json')],{
   cwd:root,trace:join(privateDir,'trace.json'),
   afterFirstCall:`unlinkSync(${JSON.stringify(alias)});symlinkSync(${JSON.stringify(repositoryDir)},${JSON.stringify(alias)},'dir');`
  });
  assert.equal(result.status,0);
  assert.equal(result.stderr,'');
  assert.equal(result.calls,27);
  assert.equal(existsSync(join(repositoryDir,'capture.json')),false);
  assert.equal(JSON.parse(readFileSync(join(actual,'capture.json'),'utf8')).rows.length,27);
 });
});
