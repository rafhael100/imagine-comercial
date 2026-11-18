import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,copyFileSync,
  symlinkSync,existsSync,statSync
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';
import {reviewLegacyCrawlCsv,crossCheckGscAndCrawl} from '../src/lib/crawl-gsc-cross-review.mjs';

const cli=fileURLToPath(new URL('../scripts/review-seo-two-sources.mjs',import.meta.url));
const fixtureRoot=fileURLToPath(new URL('./fixtures/',import.meta.url));
const refusal='SEO dual source: offline input refused (NO-GO)\n';

function fixture(fn){
  // Every input is invented. No private GSC/crawler export enters this test.
  const folder=mkdtempSync(join(tmpdir(),'comercial-private-two-source-'));
  const gscFile=join(folder,'PRIVATE_GSC_PATH_MARKER.csv');
  const crawlFile=join(folder,'PRIVATE_CRAWL_PATH_MARKER.csv');
  const secret='SYNTHETIC_ONLY_TWO_SOURCE_QUERY_TOKEN';
  const host='https://www.imaginecomunicacao.com.br';
  const gsc='Page,Clicks,Impressions\n'+
    host+'/fale-conosco.html,1979,1937\n'+
    host+'/trabalhe-conosco.html?token='+secret+',29,31\n'+
    host+'/private-gsc-only-marker/,37,41\n';
  const crawl='Address,Status Code,Comment\n'+
    host+'/fale-conosco.html,200,synthetic\n'+
    host+'/trabalhe-conosco.html?token='+secret+',200,synthetic\n'+
    host+'/private-crawl-only-marker/,404,synthetic\n';
  writeFileSync(gscFile,gsc,{mode:0o600});
  writeFileSync(crawlFile,crawl,{mode:0o600});
  const run=(args=['--gsc',gscFile,'--crawl',crawlFile],env={})=>
    spawnSync(process.execPath,[cli,...args],{
      cwd:folder,encoding:'utf8',timeout:15000,
      env:{...process.env,GITHUB_ACTIONS:'',...env}
    });
  try{return fn({folder,gscFile,crawlFile,secret,host,gsc,crawl,run});}
  finally{rmSync(folder,{recursive:true,force:true});}
}

function refused(result,folder){
  assert.equal(result.status,2,'PRIVATE_TWO_SOURCE_INPUT_MUST_BE_REFUSED');
  assert.equal(result.stdout,'');
  assert.equal(result.stderr,refusal,'PRIVATE_TWO_SOURCE_ERROR_MUST_BE_REDACTED');
  assert.equal(existsSync(join(folder,'artifacts')),false);
}

test('private GSC and crawl emit aggregate comparisons with zero artifacts',()=>{
  fixture(({folder,gscFile,crawlFile,secret,host,run})=>{
    const r=run();
    assert.equal(r.status,0,r.stderr);
    assert.equal(existsSync(join(folder,'artifacts')),false,'PRIVATE_REPORT_PERSISTED');
    assert.equal(r.stderr,'');
    assert.match(r.stdout,/"source":"PRIVATE_LOCAL_CSV_ONLY"/);
    assert.match(r.stdout,/"matched":1/);
    assert.match(r.stdout,/"gscOnly":2/);
    assert.match(r.stdout,/"crawlOnly":2/);
    assert.match(r.stdout,/"approvals":0/);
    assert.match(r.stdout,/"artifactsWritten":0/);
    assert.match(r.stdout,/"productionAuthorized":false/);
    for(const value of [folder,gscFile,crawlFile,secret,host,
      'private-gsc-only-marker','private-crawl-only-marker','1979','1937',
      'Clicks','Impressions'])
      assert.equal((r.stdout+r.stderr).includes(value),false,'PRIVATE_SOURCE_DETAIL_EXPOSED');
  });
});

test('private two-source inputs cannot execute in GitHub Actions',()=>{
  fixture(({folder,run})=>refused(run(undefined,{GITHUB_ACTIONS:'true'}),folder));
});

test('missing private inputs and CI refusals never expose filesystem paths',()=>{
  fixture(({folder,gscFile,crawlFile,run})=>{
    rmSync(gscFile);rmSync(crawlFile);
    refused(run(undefined,{GITHUB_ACTIONS:'true'}),folder);
    refused(run(),folder);
  });
});

for(const source of ['gsc','crawl']){
  test('private '+source+' source rejects invalid UTF-8 even in ignored metadata',()=>{
    fixture(({folder,gscFile,crawlFile,gsc,crawl,run})=>{
      const file=source==='gsc'?gscFile:crawlFile;
      const content=source==='gsc'?gsc:crawl;
      // Invalid byte sits in an otherwise ignored column. Lossy decoding
      // would let this export parse successfully and hide corruption.
      writeFileSync(file,Buffer.concat([Buffer.from(content.trimEnd()),Buffer.from([0xff,0x0a])]));
      refused(run(),folder);
    });
  });
  test('private '+source+' source is bounded at two MiB',()=>{
    fixture(({folder,gscFile,crawlFile,run})=>{
      writeFileSync(source==='gsc'?gscFile:crawlFile,Buffer.alloc(2*1024*1024+1,0x20));
      refused(run(),folder);
    });
  });
  test('private '+source+' source cannot follow a file symlink',
    {skip:process.platform==='win32'},()=>{
      fixture(({folder,gscFile,crawlFile,gsc,crawl,run})=>{
        const file=source==='gsc'?gscFile:crawlFile;
        const target=join(folder,'SYMLINK_TARGET.csv');
        writeFileSync(target,source==='gsc'?gsc:crawl,{mode:0o600});
        rmSync(file);symlinkSync(target,file);
        refused(run(),folder);
      });
    });
}

test('private two-source mode refuses extra, reordered and non-CSV arguments',()=>{
  fixture(({folder,gscFile,crawlFile,run})=>{
    for(const args of [[],['--gsc',gscFile],
      ['--gsc',gscFile,'--crawl',crawlFile,'--publish'],
      ['--crawl',crawlFile,'--gsc',gscFile],
      ['--synthetic','--gsc',gscFile,'--crawl',crawlFile],
      ['--gsc',folder,'--crawl',crawlFile]])
      refused(run(args),folder);
  });
});

test('invalid private CSV, foreign hosts and conflicting crawl status stay redacted',()=>{
  fixture(({folder,gscFile,crawlFile,gsc,crawl,host,run})=>{
    for(const content of ['Page\n"unterminated',
      'Page\nhttps://foreign.example/private-url-marker/\n']){
      writeFileSync(gscFile,content);refused(run(),folder);
    }
    writeFileSync(gscFile,gsc);
    for(const content of [
      'Address,Status Code\n'+host+'/fale-conosco.html,SECRET_STATUS_MARKER\n',
      crawl+host+'/fale-conosco.html,404,conflict\n'
    ]){
      writeFileSync(crawlFile,content);refused(run(),folder);
    }
  });
});

test('synthetic CI mode retains both deterministic review artifacts and zero approvals',()=>{
  fixture(({folder,run})=>{
    const copies=join(folder,'tests','fixtures');
    mkdirSync(copies,{recursive:true});
    for(const name of ['gsc-synthetic-pages.csv','crawl-synthetic-pages.csv'])
      copyFileSync(join(fixtureRoot,name),join(copies,name));
    const r=run(['--synthetic'],{GITHUB_ACTIONS:'true'});
    assert.equal(r.status,0,r.stderr);
    assert.equal(r.stderr,'');
    const output=join(folder,'artifacts','seo-two-source-review');
    const json=join(output,'REVIEW-ONLY-two-source.json');
    const summary=join(output,'REVIEW-ONLY-summary.md');
    const expected=crossCheckGscAndCrawl(
      reviewGscPagesCsv(readFileSync(join(copies,'gsc-synthetic-pages.csv'),'utf8')),
      reviewLegacyCrawlCsv(readFileSync(join(copies,'crawl-synthetic-pages.csv'),'utf8')));
    assert.deepEqual(JSON.parse(readFileSync(json,'utf8')),
      {source:'SYNTHETIC_DATA_ONLY',...expected});
    assert.match(readFileSync(summary,'utf8'),/APPROVED 301: 0/);
    assert.match(r.stdout,/"source":"SYNTHETIC_DATA_ONLY"/);
    assert.match(r.stdout,/"approvals":0/);
    if(process.platform!=='win32'){
      assert.equal(statSync(json).mode&0o777,0o600);
      assert.equal(statSync(summary).mode&0o777,0o600);
    }
  });
});
