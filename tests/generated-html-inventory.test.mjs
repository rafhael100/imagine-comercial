import test from 'node:test';
import assert from 'node:assert/strict';
import {auditGeneratedHtmlInventory as audit}
  from '../src/lib/generated-html-inventory.mjs';

const routes=['/','/contato/','/servicos/criacao-de-sites/'];
const files=['index.html','contato/index.html',
  'servicos/criacao-de-sites/index.html','404.html'];

test('F150 accepts exact public HTML inventory plus the special 404 document',()=>{
  assert.deepEqual(audit(files,routes),{
    htmlPagesChecked:4,
    approvedIndexablePages:3,
    special404Count:1,
    networkPerformed:false
  });
});
test('F150 refuses silent private pages and unreviewed editorial routes',()=>{
  for(const added of [
    'admin/index.html','portal/clientes.html',
    'sensitive-preview.html','conteudos/rascunho/index.html'
  ])assert.throws(()=>audit([...files,added],routes),
    /unexpected or missing HTML documents/);
});
test('F150 refuses omissions, duplications and case-drifts',()=>{
  assert.throws(()=>audit(files.slice(0,-1),routes),
    /unexpected or missing HTML documents/);
  assert.throws(()=>audit([...files,'404.html'],routes),
    /duplicate HTML output/);
  assert.throws(()=>audit(files,['/','/contato/','/contato/']),
    /duplicated catalog route/);
  assert.throws(()=>audit([...files,'Contato/index.html'],routes),
    /malformed HTML build path/);
});
test('F150 refuses traversal and odd file formats without disclosing their names',()=>{
  for(const file of [
    '../private.html','/index.html','assets/index.htm',
    'a//index.html','a/../secret.html','a\\index.html',
    'page.html?token=PERSONAL-SECRET-F150'
  ]) {
    try{audit([...files,file],routes);assert.fail('must reject generated path');}
    catch(error){
      assert.doesNotMatch(String(error),/PERSONAL-SECRET-F150|private\.html/);
    }
  }
});
