import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReleaseReview} from '../src/lib/release-review.mjs';
import {reviewStagingBuildIntegrity as review}
  from '../src/lib/staging-build-integrity.mjs';

const bytes=[
  ['index.html','<html lang="pt-BR"><h1>Exemplo</h1></html>'],
  ['404.html','<h1>Não encontramos a página</h1>'],
  ['robots.txt','User-agent: *\nAllow: /\n'],
  ['sitemap.xml','<urlset></urlset>'],
  ['_astro/site.css','body { margin:0 }']
];
async function temporaryPackage(){
  const dir=await mkdtemp(join(tmpdir(),'imagine-f165-stage-'));
  const root=join(dir,'dist');
  await mkdir(join(root,'_astro'),{recursive:true});
  for(const [name,value] of bytes)await writeFile(join(root,name),value);
  const initial=createReleaseReview(
    bytes.map(([path,text])=>({path,bytes:Buffer.from(text)})),
    {routes:['/']}
  );
  return {dir,root,digest:initial.treeSha256};
}
const assess=(root,expectedTreeSha256)=>review({
  root,expectedTreeSha256,routes:['/']
});
test('F165 matching complete package hash is a byte check, never a release authority',async()=>{
  const s=await temporaryPackage();
  try{
    const result=assess(s.root,s.digest);
    assert.equal(result.exactTreeBytesVerified,true);
    assert.equal(result.fileCount,bytes.length);
    assert.equal(result.htmlPages,1);
    assert.equal(result.deploymentAuthorized,false);
    assert.equal(result.expectedDigestTrustedIndependently,false);
    assert.equal(result.imageProvenanceVerified,false);
    assert.equal(result.operatorAuthorizationVerified,false);
    assert.ok(Object.isFrozen(result));
    assert.doesNotMatch(JSON.stringify(result),/Exemplo|http:\/\/|sha256:[a-f0-9]/);
  }finally{await rm(s.dir,{recursive:true,force:true});}
});
test('F165 catches a single changed byte, missing asset or unexpected HTML',async()=>{
  const s=await temporaryPackage();
  try{
    await writeFile(join(s.root,'index.html'),'<html lang="pt-BR"><h1>Exemplo!</h1></html>');
    assert.throws(()=>assess(s.root,s.digest),/bytes do not match/);
    await writeFile(join(s.root,'index.html'),bytes[0][1]);
    await rm(join(s.root,'_astro/site.css'));
    assert.throws(()=>assess(s.root,s.digest),/bytes do not match/);
    await writeFile(join(s.root,'_astro/site.css'),bytes[4][1]);
    await writeFile(join(s.root,'unapproved.html'),'<html></html>');
    assert.throws(()=>assess(s.root,s.digest),/unexpected or missing HTML/);
  }finally{await rm(s.dir,{recursive:true,force:true});}
});
test('F165 fails closed on symlinks, deployment rules, hidden secrets and oversized assets',async()=>{
  const s=await temporaryPackage();
  try{
    await symlink(join(s.root,'index.html'),join(s.root,'_astro','alias.html'));
    assert.throws(()=>assess(s.root,s.digest),/symlinks forbidden/);
    await rm(join(s.root,'_astro','alias.html'));
    for(const name of ['_redirects','_headers','.env']){
      await writeFile(join(s.root,name),'TEST_UNTRUSTED');
      assert.throws(()=>assess(s.root,s.digest),
        /invalid relative file path|deployment rules|source metadata/);
      await rm(join(s.root,name));
    }
    await writeFile(join(s.root,'_astro','large.png'),Buffer.alloc(10*1024*1024+1));
    assert.throws(()=>assess(s.root,s.digest),/package size or count/);
  }finally{await rm(s.dir,{recursive:true,force:true});}
});
test('F165 disallows caller-derived or malformed digest and rejects symlink roots',async()=>{
  const s=await temporaryPackage();
  try{
    for(const x of ['',null,123,{},'A'.repeat(64),'0'.repeat(64),
      'f'.repeat(64),s.digest.toUpperCase(),s.digest+'&token=secret'])
      assert.throws(()=>assess(s.root,x),/independently approved staging tree SHA-256/);
    await symlink(s.root,join(s.dir,'alias'));
    assert.throws(()=>assess(join(s.dir,'alias'),s.digest),/unsafe staging build directory/);
  }finally{await rm(s.dir,{recursive:true,force:true});}
});
