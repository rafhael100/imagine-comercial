import test from 'node:test';
import assert from 'node:assert/strict';
import {auditIndexableMetadata as audit} from '../src/lib/site-head-inventory.mjs';

const page=(path,title,desc)=>({
  path,
  html:'<!doctype html><html><head><title>'+title+'</title>'+
    '<meta name="description" content="'+desc+'"></head><body></body></html>'
});
const a='Conheça os serviços digitais, as etapas de projeto e as opções de contratação para sua empresa.';
const b='Compare alternativas de desenvolvimento de sites com planejamento e suporte para negócios em crescimento.';
const one=()=>page('/','Criação de sites e marketing digital | Imagine',a);
const two=()=>page('/servicos/','Soluções digitais para empresas | Imagine',b);

test('F144 detects complete unique public metadata inventory',()=>{
  const result=audit([one(),two()]);
  assert.equal(result.checkedPages,2);
  assert.equal(result.uniqueTitles,2);
  assert.equal(result.uniqueDescriptions,2);
  assert.equal(result.networkPerformed,false);
});
test('F144 refuses duplicate titles and descriptions despite case or whitespace drift',()=>{
  assert.throws(()=>audit([one(),page('/servicos/',
    'CRIAÇÃO DE SITES E MARKETING DIGITAL | IMAGINE',b)]),
    /repeated document title/);
  assert.throws(()=>audit([one(),page('/servicos/',
    'Soluções digitais para empresas | Imagine',a.replace('serviços','SERVIÇOS'))]),
    /repeated meta description/);
  assert.throws(()=>audit([one(),page('/', 'Outro título diferente sobre sites profissionais',b)]),
    /duplicated page route/);
});
test('F144 refuses truncated and missing metadata or extra head tags',()=>{
  assert.throws(()=>audit([one(),page('/servicos/','Curto',b)]),
    /title length outside bounds/);
  assert.throws(()=>audit([one(),page('/servicos/',
    'Soluções digitais para empresas | Imagine','Curta descrição')]),
    /description length outside bounds/);
  assert.throws(()=>audit([one(),{path:'/servicos/',html:'<html><body></body></html>'}]),
    /missing head/);
  const duplicated=two();
  duplicated.html=duplicated.html.replace('</head>',
    '<meta name="description" content="'+b+'"></head>');
  assert.throws(()=>audit([one(),duplicated]),/expected one meta description/);
});
test('F144 never emits raw title/description text in errors',()=>{
  const sensitive='SEO PROJECT PERSON-SECRET-ACCOUNT';
  try{
    audit([one(),page('/servicos/',sensitive,a)]);
    assert.fail('must refuse duplicate description');
  }catch(e){
    assert.doesNotMatch(String(e),/PERSON-SECRET-ACCOUNT/);
  }
});
