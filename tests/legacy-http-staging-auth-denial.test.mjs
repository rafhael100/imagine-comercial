import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const capture=fileURLToPath(new URL('../scripts/capture-legacy-http-operator.mjs',import.meta.url));
test('F310 candidate CLI denies the first synthetic 401 without creating AFTER evidence',()=>{
 const dir=mkdtempSync(join(tmpdir(),'imagine-f310-auth-denial-'));
 const target=join(dir,'after.json'),trace=join(dir,'calls.txt');
 const preload=[
  "import {writeFileSync} from 'node:fs';",
  "let calls=0;",
  "globalThis.fetch=async()=>{calls++;return new Response('SYNTHETIC_DENIED',{status:401});};",
  "process.on('exit',()=>writeFileSync("+JSON.stringify(trace)+",String(calls),{mode:0o600}));"
 ].join('\n');
 try{
  const result=spawnSync(process.execPath,[
   '--import','data:text/javascript;base64,'+Buffer.from(preload).toString('base64'),
   capture,'--candidate-local',target
  ],{
   cwd:dir,encoding:'utf8',timeout:10000,
   env:{...process.env,GITHUB_ACTIONS:'false',IMAGINE_LEGACY_HTTP_REVIEW:'1',
    IMAGINE_LEGACY_HTTP_TIMEOUT_MS:'7000',
    IMAGINE_STAGING_REVIEW_PASSWORD:'SYNTHETIC_OPERATOR_PASSWORD_1234567890'}
  });
  assert.ifError(result.error);
  assert.equal(result.status,2);
  assert.equal(result.stdout,'');
  assert.equal(result.stderr,'F-LEGACY-CAPTURE: operator evidence collection unavailable (HOLD)\n');
  assert.equal(existsSync(target),false);
  assert.equal(readFileSync(trace,'utf8'),'1');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
