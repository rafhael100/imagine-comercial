import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../scripts/review-gsc-inventory.mjs',import.meta.url));
function fixture(fn){
  const folder=mkdtempSync(join(tmpdir(),'imagine-f224-'));
  const file=join(folder,'private-export.csv');
  const confidential='PRIVATE_F224_TOKEN_NEVER_PRINT';
  const input='Page,Clicks\n'+
    '"https://www.imaginecomunicacao.com.br/fale-conosco.html?token='+
    confidential+'",1\n'+
    '"https://www.imaginecomunicacao.com.br/clientes.html",2\n';
  writeFileSync(file,input,{mode:0o600});
  const run=(args=['--file',file],extra={})=>spawnSync(process.execPath,
    [script,...args],{cwd:folder,encoding:'utf8',timeout:15000,
      env:{...process.env,GITHUB_ACTIONS:'',...extra}});
  try{return fn({folder,file,confidential,run});}
  finally{rmSync(folder,{recursive:true,force:true});}
}
test('F224 real private-file mode emits aggregate counts ONLY and never writes artifacts',()=>{
 fixture(({folder,confidential,run})=>{
  const out=run();
  assert.equal(out.status,0,out.stderr);
  assert.match(out.stdout,/PRIVATE_LOCAL_CSV_NOT_COMMITTED/);
  assert.match(out.stdout,/"deployedRedirects":0/);
  assert.doesNotMatch(out.stdout+out.stderr,new RegExp(confidential));
  assert.doesNotMatch(out.stdout+out.stderr,new RegExp(folder));
  assert.equal(existsSync(join(folder,'artifacts')),false);
 });
});
test('F224 private CSV input is never allowed in GitHub Actions',()=>{
 fixture(({folder,run})=>{
  const result=run(undefined,{GITHUB_ACTIONS:'true'});
  assert.equal(result.status,2);
  assert.equal(result.stdout,'');
  assert.equal(result.stderr,'GSC audit: offline input refused (NO-GO)\n');
  assert.equal(existsSync(join(folder,'artifacts')),false);
 });
});
test('F224 symlink, malformed UTF-8, oversized and missing CSVs fail closed',()=>{
 fixture(({folder,file,run,confidential})=>{
  const bad=()=>{
    const output=run();
    assert.equal(output.status,2);
    assert.equal(output.stdout,'');
    assert.equal(output.stderr,'GSC audit: offline input refused (NO-GO)\n');
    assert.ok(!output.stderr.includes(folder));
    assert.ok(!output.stderr.includes(confidential));
  };
  writeFileSync(file,Buffer.from([0xc3,0x28]));
  bad();
  writeFileSync(file,Buffer.alloc(2*1024*1024+1));
  bad();
  rmSync(file);
  bad();
  if(process.platform!=='win32'){
    const target=join(folder,'target.csv');
    writeFileSync(target,'Page\n/fale-conosco.html\n');
    symlinkSync(target,file);
    bad();
  }
 });
});
test('F224 unknown flags and bad inputs cannot activate redirect or leak paths',()=>{
 fixture(({folder,file,run})=>{
  for(const args of [
    [],['--publish'],['--file',file,'--deploy'],['--file',folder],
    ['--synthetic','--file',file]
  ]){
    const result=run(args);
    assert.equal(result.status,2);
    assert.equal(result.stdout,'');
    assert.equal(result.stderr,'GSC audit: offline input refused (NO-GO)\n');
  }
 });
});
