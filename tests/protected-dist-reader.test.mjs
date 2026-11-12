import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readProtectedDist} from '../src/lib/read-protected-dist.mjs';
import {readFileSync} from 'node:fs';
const build=readFileSync(new URL('../scripts/build-protected-release.mjs',import.meta.url),'utf8');
const verify=readFileSync(new URL('../scripts/verify-protected-package.mjs',import.meta.url),'utf8');
function fixture(fn){
 const root=mkdtempSync(join(tmpdir(),'imagine-f217-dist-'));
 try{return fn(root);}finally{rmSync(root,{recursive:true,force:true});}
}
test('F217 two protected scripts read the SAME bounded binary tree implementation',()=>{
 for(const source of [build,verify]){
   assert.match(source,/import \{readProtectedDist\} from '\.\.\/src\/lib\/read-protected-dist\.mjs'/);
   assert.match(source,/readProtectedDist\(\)/);
   assert.doesNotMatch(source,/function readTree\(/);
 }
});
test('F217 deterministic binary tree returns exact bytes and normalized local paths',()=>{
 fixture(root=>{
  mkdirSync(join(root,'servicos'));
  mkdirSync(join(root,'servicos','onepage'));
  const binary=Buffer.from([0,255,10,128,64]);
  writeFileSync(join(root,'servicos','onepage','index.html'),'<h1>Revisão offline</h1>');
  writeFileSync(join(root,'picture.png'),binary);
  const tree=readProtectedDist(root);
  assert.ok(Object.isFrozen(tree));
  assert.deepEqual(tree.map(x=>x.path).sort(),[
    'picture.png','servicos/onepage/index.html']);
  assert.deepEqual(tree.find(x=>x.path==='picture.png').bytes,binary);
  assert.ok(Object.isFrozen(tree[0]));
 });
});
test('F217 rejects symlinks, excessively deep paths and unexpected names',()=>{
 if(process.platform==='win32')return;
 fixture(root=>{
   const outside=join(root,'target.txt');writeFileSync(outside,'SYNTHETIC');
   symlinkSync(outside,join(root,'linked.txt'));
   assert.throws(()=>readProtectedDist(root),/symlink output forbidden/);
   rmSync(join(root,'linked.txt'));
   let folder=root;
   for(let i=0;i<22;i++){
     folder=join(folder,'part'+i);mkdirSync(folder);
   }
   writeFileSync(join(folder,'index.html'),'x');
   assert.throws(()=>readProtectedDist(root),/directory depth exceeded/);
 });
});
test('F217 blocks unbounded entries and oversized file before returning evidence',()=>{
 fixture(root=>{
   for(let i=0;i<501;i++)writeFileSync(join(root,'part'+i+'.txt'),'x');
   assert.throws(()=>readProtectedDist(root),/file budget exceeded/);
 });
 fixture(root=>{
   writeFileSync(join(root,'large.bin'),Buffer.alloc(10*1024*1024+1));
   assert.throws(()=>readProtectedDist(root),/unsafe output file/);
 });
});
test('F217 fails closed for missing or non-directory root',()=>{
 fixture(root=>{
   const file=join(root,'only.txt');writeFileSync(file,'x');
   assert.throws(()=>readProtectedDist(file),/unsafe directory/);
   assert.throws(()=>readProtectedDist(join(root,'missing')),/unavailable directory/);
 });
});
