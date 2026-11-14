import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';

const build=readFileSync(new URL('../scripts/build-protected-release.mjs',import.meta.url),'utf8');
const verify=readFileSync(new URL('../scripts/verify-protected-package.mjs',import.meta.url),'utf8');
test('F216 protected signer and independent verifier share descriptor-safe reader',()=>{
  for(const script of [build,verify]){
    assert.match(script,/import \{readApprovedFile\} from '\.\.\/src\/lib\/read-approved-file\.mjs'/);
    assert.match(script,/return readApprovedFile\(path,maxBytes,name\)|return readApprovedFile\(path,max,label\)/);
    assert.doesNotMatch(script,/return readFileSync\(path,'utf8'\)/);
  }
});
test('F216 descriptor reader accepts a bounded, exact UTF-8 signed input',()=>{
  const root=mkdtempSync(join(tmpdir(),'imagine-f216-'));
  try{
    const path=join(root,'envelope.json');
    const text='{"title":"Criação de Landing Pages"}';
    writeFileSync(path,text);
    assert.equal(readApprovedFile(path,512,'envelope'),text);
    assert.throws(()=>readApprovedFile(path,8,'envelope'),/unsafe envelope file/);
    assert.throws(()=>readApprovedFile('',512,'envelope'),/invalid envelope path/);
    assert.throws(()=>readApprovedFile(join(root,'unknown.json'),512,'envelope'),
      /unsafe envelope file/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('F216 rejects symlink and malformed UTF-8 signed/review files without echoing paths',()=>{
  const root=mkdtempSync(join(tmpdir(),'imagine-f216-malformed-'));
  try{
    const real=join(root,'real.json'),alias=join(root,'link.json');
    writeFileSync(real,Buffer.from([0xc3,0x28]));
    assert.throws(()=>readApprovedFile(real,512,'signed document'),error=>{
      assert.match(error.message,/unsafe signed document file/);
      assert.equal(error.message.includes(root),false);
      return true;
    });
    if(process.platform!=='win32'){
      writeFileSync(real,'{"trusted":true}');
      symlinkSync(real,alias);
      assert.throws(()=>readApprovedFile(alias,512,'signed document'),
        /unsafe signed document file/);
    }
  }finally{rmSync(root,{recursive:true,force:true});}
});
