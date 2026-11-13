import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildStagingHostRouteChecklist} from '../src/lib/staging-host-route-matrix.mjs';

const script=fileURLToPath(new URL('../scripts/review-host-route-staging.mjs',import.meta.url));
const observations=()=>buildStagingHostRouteChecklist().map(x=>({
  origin:x.origin,path:x.path,status:x.expectedStatus,
  location:x.expectedLocation,tlsValid:x.expectedTlsValid,noindex:x.expectedNoindex
}));
function withFixture(fn){
  const dir=mkdtempSync(join(tmpdir(),'f228-private-'));
  const file=join(dir,'operator-secret.json');
  writeFileSync(file,JSON.stringify(observations()),{mode:0o600});
  const run=(args=['--file',file],env={})=>spawnSync(process.execPath,
    [script,...args],{cwd:dir,encoding:'utf8',timeout:15000,
    env:{...process.env,GITHUB_ACTIONS:'',...env}});
  try{fn({dir,file,run});}finally{rmSync(dir,{recursive:true,force:true});}
}
test('F228 synthetic CI path reviews the entire matrix without any release authority',()=>{
  withFixture(({dir,run})=>{
    const result=run(['--synthetic']);
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/"source":"SYNTHETIC_ONLY"/);
    assert.match(result.stdout,/"profile":"FUTURE_PUBLIC_EDGE_TARGET_SIMULATION_NOT_LEASEWEB_PRIVATE"/);
    assert.match(result.stdout,/"failed":0/);
    assert.match(result.stdout,/"productionAuthorized":false/);
    assert.equal(existsSync(join(dir,'artifacts')),false);
  });
});
test('F228 private JSON mode only prints aggregate results; never writes input to repo',()=>{
  withFixture(({dir,run})=>{
    const result=run();
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/"source":"PRIVATE_OPERATOR_UNVERIFIED"/);
    assert.doesNotMatch(result.stdout+result.stderr,/operator-secret|f228-private-/);
    assert.equal(existsSync(join(dir,'artifacts')),false);
  });
});
test('F228 genuine mismatch stays NO-GO even if the JSON schema is valid',()=>{
  withFixture(({dir,file,run})=>{
    const rows=observations(),idx=rows.findIndex(x=>x.path==='/clientes.html');
    assert.ok(idx>=0);
    rows[idx]={...rows[idx],status:301,location:'https://imaginecomunicacao.com.br/'};
    writeFileSync(file,JSON.stringify(rows));
    const result=run();
    assert.equal(result.status,1);
    assert.match(result.stdout,/"futureEdgeContractPassed":false/);
    assert.match(result.stdout,/"productionAuthorized":false/);
    assert.doesNotMatch(result.stdout+result.stderr,/clientes\.html/);
    assert.equal(existsSync(join(dir,'artifacts')),false);
  });
});
test('F228 rejects files inside GitHub Actions and unknown CLI arguments',()=>{
  withFixture(({file,run})=>{
    const blocked=run(undefined,{GITHUB_ACTIONS:'true'});
    assert.equal(run(undefined,{IMAGINE_PRIVATE_STAGING_REVIEW:'1'}).status,2);
    assert.equal(blocked.status,2);
    assert.equal(blocked.stdout,'');
    assert.equal(blocked.stderr,'F228 staging evidence refused (NO-GO)\n');
    for(const args of [[],['--publish'],['--file',file,'--deploy'],['--synthetic','--file',file]]){
      const result=run(args);
      assert.equal(result.status,2);
      assert.equal(result.stdout,'');
    }
  });
});
test('F228 refuses symlinks, bad UTF-8, oversize and unknown observation fields',()=>{
  withFixture(({dir,file,run})=>{
    const bad=()=>{
      const result=run();
      assert.equal(result.status,2);
      assert.equal(result.stdout,'');
      assert.equal(result.stderr,'F228 staging evidence refused (NO-GO)\n');
    };
    writeFileSync(file,Buffer.from([0xc3,0x28]));bad();
    writeFileSync(file,Buffer.alloc(1024*1024+1));bad();
    const rows=observations();rows[0].sessionToken='DONT_LOG_THIS_SECRET';
    writeFileSync(file,JSON.stringify(rows));bad();
    rmSync(file);
    if(process.platform!=='win32'){
      const target=join(dir,'real.json');
      writeFileSync(target,JSON.stringify(observations()));
      symlinkSync(target,file);bad();
    }
  });
});
