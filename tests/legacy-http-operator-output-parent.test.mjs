import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync,existsSync,mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const capture=fileURLToPath(new URL('../scripts/capture-legacy-http-operator.mjs',import.meta.url));
const noLeak='F-LEGACY-CAPTURE: operator evidence collection unavailable (HOLD)\n';
function withOutput(run){
 const dir=mkdtempSync(join(tmpdir(),'imagine-f310-output-protection-'));
 try{return run({dir,target:join(dir,'before.json'),trace:join(dir,'trace')});}
 finally{chmodSync(dir,0o700);rmSync(dir,{recursive:true,force:true});}
}
function execute(target,trace){
 // Never create an external socket: the preloader records every attempted GET
 // and returns synthetic HTML. The CLI must reject an unsafe directory first.
 const preload=[
  "import {writeFileSync} from 'node:fs';",
  "let calls=0;",
  "globalThis.fetch=async()=>{calls++;return new Response('SYNTHETIC_OUTPUT_PRIVATE',{status:200,headers:{'content-type':'text/html'}});};",
  "process.on('exit',()=>writeFileSync("+JSON.stringify(trace)+",String(calls),{mode:0o600}));"
 ].join('\n');
 const proc=spawnSync(process.execPath,[
   '--import','data:text/javascript;base64,'+Buffer.from(preload).toString('base64'),
   capture,'--original',target
 ],{cwd:tmpdir(),encoding:'utf8',timeout:10000,env:{...process.env,
    GITHUB_ACTIONS:'false',IMAGINE_LEGACY_HTTP_REVIEW:'1',
    IMAGINE_LEGACY_HTTP_TIMEOUT_MS:'7000'}});
 assert.ifError(proc.error);
 return proc;
}
for(const mode of [0o755,0o770,0o701]){
 test('F310 capture refuses output parent '+mode.toString(8)+' before HTTP',()=>withOutput(({dir,target,trace})=>{
  chmodSync(dir,mode);
  const p=execute(target,trace);
  assert.equal(p.status,2);
  assert.equal(p.stderr,noLeak);
  assert.equal(p.stdout,'');
  assert.equal(readFileSync(trace,'utf8'),'0','no attempted GET');
  assert.equal(existsSync(target),false);
  assert.doesNotMatch(p.stderr,/SYNTHETIC_OUTPUT_PRIVATE|before\.json|imagine-f310/);
 }));
}
test('F310 capture permits private owned 0700 parent and creates only 0600 evidence',()=>withOutput(({target,trace})=>{
 const p=execute(target,trace);
 assert.equal(p.status,0,p.stderr);
 assert.equal(p.stderr,'');
 assert.equal(readFileSync(trace,'utf8'),'27');
 assert.equal(statSync(target).mode&0o777,0o600);
 assert.equal(JSON.parse(readFileSync(target,'utf8')).rows.length,27);
}));
