import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPublicHeadingStructure as audit}
  from '../src/lib/heading-structure-contract.mjs';

const page=(body)=>'<html lang="pt-BR"><main>'+body+'</main></html>';
test('F146 approves unique descriptive H1 followed by H2 and nested H3',()=>{
  const valid=page('<h1>Sites profissionais para empresas</h1>'+
    '<h2>Planejamento e qualidade</h2><h3>Estrutura acessível</h3>'+
    '<h2>Saiba como contratar</h2>');
  const result=audit(valid);
  assert.equal(result.h1Count,1);
  assert.equal(result.headingsChecked,4);
  assert.equal(result.networkPerformed,false);
});
test('F146 rejects multiple or missing H1 and headings before the title',()=>{
  assert.throws(()=>audit(page('<h2>Uma seção qualquer</h2>')),
    /exactly one H1/);
  assert.throws(()=>audit(page('<h1>Sites profissionais para empresas</h1>'+
    '<h1>Outro título sem motivo</h1><h2>Informações</h2>')),
    /exactly one H1/);
  assert.throws(()=>audit(page('<h2>Outras soluções</h2>'+
    '<h1>Sites profissionais para empresas</h1>')),
    /first heading must be H1/);
});
test('F146 protects heading meaning and avoids skipped semantic levels',()=>{
  assert.throws(()=>audit(page('<h1>Raso</h1><h2>Conteúdo</h2>')),
    /H1 must be descriptive/);
  assert.throws(()=>audit(page('<h1>Sites profissionais para empresas</h1>'+
    '<h3>Subtítulo errado</h3><h2>Outro conteúdo</h2>')),
    /heading hierarchy jumps/);
  assert.throws(()=>audit(page('<h1>Sites profissionais para empresas</h1>'+
    '<h2> </h2>')),
    /empty or excessive heading/);
  assert.throws(()=>audit(page('<h1>Sites profissionais para empresas</h1>')),
    /thematic H2/);
});
test('F146 descriptions in errors avoid revealing raw page copy',()=>{
  try{audit(page('<h1>PERSON-SECRET-HEADING</h1><h3>Quebra</h3>'));}
  catch(e){assert.doesNotMatch(String(e),/PERSON-SECRET-HEADING/);return;}
  assert.fail('expected a heading-depth error');
});
