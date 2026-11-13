import test from 'node:test';
import assert from 'node:assert/strict';
import {auditIndexableMetadata} from '../src/lib/site-head-inventory.mjs';

const descriptions=[
  'Conheça soluções digitais para empresas com planejamento e presença online consistente.',
  'Compare opções de serviços digitais e identifique o próximo passo adequado ao seu negócio.'
];
const make=(route,title,desc)=>({
  path:route,
  html:'<!doctype html><html><head><title>'+title+'</title>'+
    '<meta name="description" content="'+desc+'"/></head><body></body></html>'
});
const valid=()=>[
  make('/','Criação de sites e serviços digitais | Imagine',descriptions[0]),
  make('/servicos/','Soluções de marketing e sites | Imagine',descriptions[1])
];

test('F271 metadata inventory still approves real titles and descriptions',()=>{
  const result=auditIndexableMetadata(valid());
  assert.equal(result.checkedPages,2);
  assert.equal(result.uniqueDescriptions,2);
});

test('F271 data-name and aria-name never impersonate the meta description',()=>{
  for(const fake of ['data-name','aria-name']){
    const pages=valid();
    pages[0].html=pages[0].html.replace('name="description"',fake+'="description"');
    assert.throws(()=>auditIndexableMetadata(pages),/expected one meta description/);
  }
});

test('F271 data-content and duplicate content cannot forge real description',()=>{
  const pages=valid();
  pages[0].html=pages[0].html.replace('content="'+descriptions[0]+'"',
    'data-content="'+descriptions[0]+'"');
  assert.throws(()=>auditIndexableMetadata(pages),/description length outside bounds/);
  const duplicated=valid();
  duplicated[0].html=duplicated[0].html.replace('name="description"',
    'name="description" NAME="description"');
  assert.throws(()=>auditIndexableMetadata(duplicated),/duplicate SEO attribute/);
});
