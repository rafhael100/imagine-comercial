#!/usr/bin/env node
/**
 * P0 F160 — deterministic and PRIVATE synthetic review matrix.
 * No arguments, stdin, HTTP, storage, credentials, real tenants or PII output.
 * This is a diagnostic, NOT an operational lead acceptance service.
 */
import {reviewPrivateBudgetToCrmLab} from '../src/lib/private-budget-crm-review.mjs';
if(process.argv.length!==2)throw new Error('P0 F160: no CLI arguments supported');
const uuids=[
 'bde4f010-aacf-4ad7-a302-94c507bb1111',
 'bde4f010-aacf-4ad7-a302-94c507bb2222',
 'bde4f010-aacf-4ad7-a302-94c507bb3333',
 'bde4f010-aacf-4ad7-a302-94c507bb4444',
 'bde4f010-aacf-4ad7-a302-94c507bb5555',
 'bde4f010-aacf-4ad7-a302-94c507bb6666'
];
function envelope(){
 return {
  protocol:'imagine.lead-intake',schema_version:1,
  organization_reference:uuids[0],binding_reference:uuids[1],
  submission_reference:uuids[2],site_reference:uuids[3],
  form_reference:uuids[4],destination_reference:uuids[5]
 };
}
function draft(){
 return {
  name:'Cliente inteiramente fictício',role:'',
  email:'demo@example.invalid',phone:'',mobile:'',
  serviceSlug:'onepage',
  details:'Exemplo sem informação pessoal verdadeira.',
  challengePreview:'5',previewUnderstanding:true
 };
}
function original(){
 return {privateDraft:draft(),envelope:envelope(),
  storedSnapshot:{original:envelope(),phase:'open',version:0},
  expectedVersion:0};
}
const scenarios=[
 ['estrutura-compativel',original()],
 ['contato-invalido',(()=>{const x=original();x.privateDraft.email='bad';return x;})()],
 ['versao-obsoleta',(()=>{const x=original();x.expectedVersion=1;return x;})()],
 ['resultado-incerto',(()=>{const x=original();x.storedSnapshot.phase='outcome_unknown';return x;})()],
 ['destino-divergente',(()=>{const x=original();x.envelope.destination_reference=
   'bde4f010-aacf-4ad7-a302-94c507bb9999';return x;})()]
];
const results=scenarios.map(([scenario,input])=>{
 const assessment=reviewPrivateBudgetToCrmLab(input);
 if(assessment.canCreateCrmLead||assessment.canAcknowledgeVisitor||assessment.canDeploy)
   throw new Error('P0 F160: operational privilege is forbidden');
 return {scenario,stage:assessment.stage,reasonCode:assessment.reasonCode,
   canCreateCrmLead:false,canAcknowledgeVisitor:false};
});
console.log(JSON.stringify({
 schema:'imagine.comercial.private-budget-review-matrix.v1',
 mode:'OFFLINE_SYNTHETIC_ONLY',
 sampleCount:results.length,
 operationalReadiness:'BLOCKED',
 results
},null,2));
