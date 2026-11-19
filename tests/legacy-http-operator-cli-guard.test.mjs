import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

function run(file,args,extra={}){
 return spawnSync(process.execPath,[file,...args],{
  cwd:resolve('.'),encoding:'utf8',timeout:7000,
  env:{...process.env,GITHUB_ACTIONS:'true',IMAGINE_LEGACY_HTTP_REVIEW:'1',
   IMAGINE_STAGING_REVIEW_PASSWORD:'SECRET_CANNOT_ESCAPE_'+
     'correct-horse-battery-staple',...extra}
 });
}
test('F310 neither operator HTTP capture nor evidence comparison can execute inside GitHub Actions',()=>{
 for(const [file,args] of [
  ['scripts/capture-legacy-http-operator.mjs',
   ['--original','/tmp/legacy-before-f310.json']],
  ['scripts/capture-legacy-http-operator.mjs',
   ['--candidate-local','/tmp/legacy-after-f310.json']],
  ['scripts/review-legacy-http-operator.mjs',
   ['--before','/tmp/legacy-before-f310.json',
    '--after','/tmp/legacy-after-f310.json']]
 ]){
  const result=run(file,args);
  assert.equal(result.status,2,file);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/HOLD/);
  assert.doesNotMatch(result.stderr,/SECRET_CANNOT_ESCAPE|\/tmp\/|legacy-before|correct-horse/);
 }
});
test('F310 operator tools reject disabled/invalid invocation before any HTTP or read',()=>{
 for(const file of [
  'scripts/capture-legacy-http-operator.mjs',
  'scripts/review-legacy-http-operator.mjs'
 ]){
  const result=run(file,[],{GITHUB_ACTIONS:'false',
   IMAGINE_LEGACY_HTTP_REVIEW:'0'});
  assert.equal(result.status,2,file);
  assert.match(result.stderr,/HOLD/);
  assert.equal(result.stdout,'');
 }
});

const captureError='F-LEGACY-CAPTURE: operator evidence collection unavailable (HOLD)\n';
const syntheticPassword='SYNTHETIC_TIMEOUT_PASSWORD_123456789';
const preservedSnapshot='SYNTHETIC_EXISTING_SNAPSHOT\n';

function captureWithSyntheticFetch({mode='--original',timeout,extra={},existing=false}={}){
 const dir=mkdtempSync(join(tmpdir(),'imagine-legacy-timeout-test-'));
 const target=join(dir,'snapshot.json'),trace=join(dir,'synthetic-calls.json');
 // The real CLI runs in a subprocess. Install a fully synthetic fetch before
 // its module imports, and record the timeout bound to every requested signal.
 // No socket, real response, operator input or elapsed-time wait is involved.
 const preload=`
  import {writeFileSync} from 'node:fs';
  const calls=[],timeouts=new WeakMap();
  AbortSignal.timeout=timeoutMs=>{
   const signal=new AbortController().signal;
   timeouts.set(signal,timeoutMs);
   return signal;
  };
  globalThis.fetch=async(url,init)=>{
   calls.push({url,method:init.method,redirect:init.redirect,
    credentials:init.credentials,headers:init.headers,
    timeoutMs:timeouts.get(init.signal)});
   return new Response('SYNTHETIC_TIMEOUT_HTML',{
    status:200,headers:{'content-type':'text/html; charset=UTF-8'}
   });
  };
  process.on('exit',()=>writeFileSync(${JSON.stringify(trace)},
   JSON.stringify(calls),{mode:0o600}));
 `;
 const env={...process.env,GITHUB_ACTIONS:'false',
  IMAGINE_LEGACY_HTTP_REVIEW:'1',
  IMAGINE_STAGING_REVIEW_PASSWORD:syntheticPassword,...extra};
 delete env.IMAGINE_LEGACY_HTTP_TIMEOUT_MS;
 if(timeout!==undefined)env.IMAGINE_LEGACY_HTTP_TIMEOUT_MS=timeout;
 try{
  if(existing)writeFileSync(target,preservedSnapshot,{mode:0o600});
  const result=spawnSync(process.execPath,[
   '--import','data:text/javascript;base64,'+Buffer.from(preload).toString('base64'),
   resolve('scripts/capture-legacy-http-operator.mjs'),mode,target
  ],{cwd:resolve('.'),env,encoding:'utf8',timeout:7000});
  assert.ifError(result.error);
  assert.equal(result.signal,null);
  assert.ok(existsSync(trace),'synthetic transport observer must finish');
  return {...result,calls:JSON.parse(readFileSync(trace,'utf8')),
   output:existsSync(target)?readFileSync(target,'utf8'):null,
   outputMode:existsSync(target)?statSync(target).mode&0o777:null};
 }finally{rmSync(dir,{recursive:true,force:true});}
}

function assertSyntheticCapture(result,mode,timeoutMs){
 assert.equal(result.status,0);
 assert.equal(result.stderr,'');
 assert.equal(result.stdout,'Legacy HTTP snapshot collected for 27 curated paths; '+
  'PRIVATE REVIEW ONLY, no redirects or deploy.\n');
 const local=mode==='--candidate-local';
 const origin=local?'http://127.0.0.1:4321':'https://www.imaginecomunicacao.com.br';
 assert.deepEqual(result.calls,legacyUrls.map(({from})=>({
  url:origin+from,method:'GET',redirect:'manual',credentials:'omit',
  headers:{Accept:'text/html',...(local?{
   Authorization:'Basic '+Buffer.from('reviewer:'+syntheticPassword).toString('base64')
  }:{})},timeoutMs
 })));
 const snapshot=JSON.parse(result.output);
 assert.equal(snapshot.scope,local?'AFTER_CANDIDATE':'BEFORE_ORIGINAL');
 assert.deepEqual(snapshot.rows.map(row=>row.path),legacyUrls.map(row=>row.from));
 assert.equal(snapshot.rows.every(row=>row.status===200),true);
 assert.equal(result.outputMode,0o600);
 assert.doesNotMatch(result.output,/SYNTHETIC_TIMEOUT_HTML|SYNTHETIC_TIMEOUT_PASSWORD/);
}

test('F310 capture CLI keeps the 7000ms default for both fixed origins',()=>{
 for(const mode of ['--original','--candidate-local'])
  assertSyntheticCapture(captureWithSyntheticFetch({mode}),mode,7000);
});

test('F310 capture CLI forwards canonical timeout boundaries and an interior value to every GET',()=>{
 for(const timeout of ['1000','8765','10000']){
  for(const mode of ['--original','--candidate-local'])
   assertSyntheticCapture(captureWithSyntheticFetch({mode,timeout}),mode,Number(timeout));
 }
});

test('F310 capture CLI refuses invalid timeout values before any transport or snapshot write',()=>{
 for(const timeout of ['', '0','999','10001','-1000','+1000','01000','1000.0',
  '1e3','0x3e8',' 1000','1000 ','1000\n','１０００','Infinity','NaN',
  '1_000','10000x','999999999999999999999999']){
  for(const mode of ['--original','--candidate-local']){
   const result=captureWithSyntheticFetch({mode,timeout});
   assert.equal(result.status,2,'invalid timeout must fail closed');
   assert.equal(result.stdout,'');
   assert.equal(result.stderr,captureError);
   assert.deepEqual(result.calls,[],'invalid timeout must not reach fetch');
   assert.equal(result.output,null,'invalid timeout must not create a snapshot');
  }
 }
});

test('F310 capture CLI timeout override cannot bypass CI or operator opt-in guards',()=>{
 for(const extra of [{GITHUB_ACTIONS:'true'},{IMAGINE_LEGACY_HTTP_REVIEW:'0'},
  {IMAGINE_LEGACY_HTTP_REVIEW:''}]){
  for(const mode of ['--original','--candidate-local']){
   const result=captureWithSyntheticFetch({mode,timeout:'10000',extra});
   assert.equal(result.status,2);
   assert.equal(result.stdout,'');
   assert.equal(result.stderr,captureError);
   assert.deepEqual(result.calls,[]);
   assert.equal(result.output,null);
  }
 }
});

test('F310 capture CLI with timeout override preserves exclusive private snapshot writes',()=>{
 const result=captureWithSyntheticFetch({timeout:'10000',existing:true});
 assert.equal(result.status,2);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr,captureError);
 assert.equal(result.calls.length,27);
 assert.equal(result.output,preservedSnapshot);
 assert.equal(result.outputMode,0o600);
});
