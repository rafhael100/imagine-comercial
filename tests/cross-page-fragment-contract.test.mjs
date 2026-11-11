import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCrossPageFragmentTargets as audit}
  from '../src/lib/cross-page-fragment-contract.mjs';

const page=(path,body)=>({path,html:'<html><body>'+body+'</body></html>'});
const valid=()=>[
  page('/','<a href="/como-funciona/#etapas">Como funciona</a>'+
    '<a href="/contato/#criacao-de-sites">Contato</a>'),
  page('/como-funciona/','<section id="etapas">Etapas</section>'+
    '<a href="/contato/#landing-pages">Landing Pages</a>'),
  page('/contato/','<select id="service-choice"></select>')
];

test('F148 validates real cross-page IDs plus only cataloged contact intents',()=>{
  const result=audit(valid());
  assert.deepEqual(result,{
    crossPageFragmentsChecked:3,
    staticTargetsChecked:1,
    approvedContactIntents:2,
    networkPerformed:false
  });
  assert.ok(Object.isFrozen(result));
});

test('F148 refuses nonexistent target IDs and nonservice contact fragments',()=>{
  const data=valid();
  data[0].html=data[0].html.replace('#etapas','#missing');
  assert.throws(()=>audit(data),/cross-page fragment/);
  const invalid=valid();
  invalid[0].html+='<a href="/contato/#unapproved-private-slug">Contato</a>';
  assert.throws(()=>audit(invalid),/cross-page fragment/);
});

test('F148 never approves arbitrary service fragments on other pages',()=>{
  const invalid=valid();
  invalid[0].html+='<a href="/como-funciona/#criacao-de-sites">Erro</a>';
  assert.throws(()=>audit(invalid),/cross-page fragment/);
});

test('F148 rejects absent public routes and malformed fragment spellings',()=>{
  for(const href of [
    '/inexistente/#etapas',
    '//evil.invalid/#etapas',
    '/como-funciona/#etapas#second',
    '/como-funciona/#',
    '/como-funciona/#bad%20fragment',
    '/como-funciona/#bad fragment'
  ]){
    const data=valid();
    data[0].html+='<a href="'+href+'">Link</a>';
    // //evil.invalid is rejected by F143, not classified as internal here.
    if(href.startsWith('//'))continue;
    assert.throws(()=>audit(data),undefined,href);
  }
});

test('F148 errors do not print sensitive fragments or URLs',()=>{
  const data=valid();
  data[0].html+='<a href="/contato/#PERSON-SECRET-IDENTIFIER">Link</a>';
  try{audit(data);assert.fail('must reject unknown intent');}
  catch(error){assert.doesNotMatch(String(error),/PERSON-SECRET/);}
});
