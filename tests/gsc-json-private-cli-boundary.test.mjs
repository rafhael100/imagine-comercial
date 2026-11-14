import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../scripts/review-gsc-api-json.mjs',import.meta.url));
function fixture(fn){
  const folder=mkdtempSync(join(tmpdir(),'f242-private-gsc-'));
  const file=join(folder,'sensitive-api-pages.json');
  const secret='F242_DO_NOT_PRINT_THIS_QUERY_TOKEN';
  const payload={siteUrl:'sc-domain:imaginecomunicacao.com.br',dimensions:['page'],
    rows:[
      {keys:['https://www.imaginecomunicacao.com.br/fale-conosco.html?token='+secret],
        clicks:15,impressions:359},
      {keys:['https://www.imaginecomunicacao.com.br/trabalhe-conosco.html'],
        clicks:7,impressions:55}
    ]};
  writeFileSync(file,JSON.stringify(payload),{mode:0o600});
  const run=(args=['--file',file],env={})=>spawnSync(process.execPath,
    [cli,...args],{cwd:folder,encoding:'utf8',timeout:15000,
      env:{...process.env,GITHUB_ACTIONS:'',...env}});
  try{return fn({folder,file,secret,run});}
  finally{rmSync(folder,{recursive:true,force:true});}
}

test('F242 private JSON emits only aggregate safe counts and no artifacts',()=>{
  fixture(({folder,file,secret,run})=>{
    const r=run();
    assert.equal(r.status,0,r.stderr);
    assert.match(r.stdout,/"source":"PRIVATE_JSON_NOT_COMMITTED"/);
    assert.match(r.stdout,/"pagesReviewed":2/);
    assert.match(r.stdout,/"approvedRedirects":0/);
    assert.match(r.stdout,/"productionAuthorized":false/);
    assert.match(r.stdout,/"artifactsWritten":0/);
    assert.equal(r.stderr,'');
    for(const forbidden of [secret,folder,file,'fale-conosco','359','clicks','impressions'])
      assert.equal((r.stdout+r.stderr).includes(forbidden),false,forbidden);
    assert.equal(existsSync(join(folder,'artifacts')),false);
  });
});
test('F242 blocks real GSC JSON inside public GitHub Actions',()=>{
  fixture(({folder,run})=>{
    const r=run(undefined,{GITHUB_ACTIONS:'true'});
    assert.equal(r.status,2);
    assert.equal(r.stdout,'');
    assert.equal(r.stderr,'GSC private JSON: offline input refused (NO-GO)\n');
    assert.equal(existsSync(join(folder,'artifacts')),false);
  });
});
test('F242 rejects malformed JSON, invalid UTF-8, oversize and symlink',()=>{
  fixture(({folder,file,run})=>{
    const bad=()=>{
      const r=run();
      assert.equal(r.status,2);
      assert.equal(r.stdout,'');
      assert.equal(r.stderr,'GSC private JSON: offline input refused (NO-GO)\n');
      assert.equal(existsSync(join(folder,'artifacts')),false);
    };
    writeFileSync(file,'{not JSON');bad();
    writeFileSync(file,Buffer.from([0xc3,0x28]));bad();
    writeFileSync(file,Buffer.alloc(2*1024*1024+1));bad();
    rmSync(file);bad();
    if(process.platform!=='win32'){
      const target=join(folder,'real.json');
      writeFileSync(target,JSON.stringify({siteUrl:'sc-domain:imaginecomunicacao.com.br',dimensions:['page'],
        rows:[{keys:['https://www.imaginecomunicacao.com.br/fale-conosco.html']}]}));
      symlinkSync(target,file);bad();
    }
  });
});
test('F242 refuses unexpected arguments, foreign projects, query dimensions',()=>{
  fixture(({folder,file,run})=>{
    for(const args of [[],['--publish'],['--file',folder],
      ['--file',file,'--deploy'],['--synthetic','--file',file]]){
      const r=run(args);assert.equal(r.status,2);
      assert.equal(r.stdout,'');
      assert.equal(r.stderr,'GSC private JSON: offline input refused (NO-GO)\n');
    }
    for(const override of [
      {siteUrl:'sc-domain:other-example.com',dimensions:['page'],rows:[{keys:['/']} ]},
      {siteUrl:'sc-domain:imaginecomunicacao.com.br',dimensions:['query'],rows:[{keys:['test']} ]}
    ]){
      writeFileSync(file,JSON.stringify(override));
      const r=run();assert.equal(r.status,2);
      assert.equal(r.stdout,'');
    }
    assert.equal(existsSync(join(folder,'artifacts')),false);
  });
});
