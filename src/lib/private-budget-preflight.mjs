/**
 * P0 Budget F157: isolated, side-effect-free PREVIEW assessment of the
 * seven legacy contact controls and service choice. Never use as a
 * public intake endpoint or as evidence of consent, anti-bot or CRM ACK.
 * No personal/contact field is returned, logged, saved or transmitted.
 */
import {services} from '../data/services.mjs';
import {inspectSyntheticImagineSiteFormMinimum} from './crm-form-minimum-parity-lab.mjs';

const FIELDS=Object.freeze([
  'name','role','email','phone','mobile','serviceSlug',
  'details','challengePreview','previewUnderstanding'
]);
const SERVICE_SLUGS=new Set(services.map(s=>s.slug));
const CONTROLS=/[\x00-\x1f\x7f]/;
const PHONE=/^\+?[0-9][0-9 ()-]{0,39}$/;
const EMAIL=/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
function outcome(code,structureMatches=false){
  return Object.freeze({
    schema:'imagine.comercial.private-budget-preflight.v1',
    mode:'SYNTHETIC_REVIEW_ONLY',
    code,
    structureMatches,
    publicIntakeAllowed:false,
    consentProvenanceVerified:false,
    serverAntiBotVerified:false,
    authenticatedTenantVerified:false,
    durableCrmReceiptVerified:false,
    canPersist:false,
    canSendToPortal:false,
    canSendToCrm:false,
    canAcknowledgeVisitor:false,
    canReplaceLegacyBudgetForm:false,
    canDeploy:false
  });
}
function contactPhone(value){
  if(!value)return true;
  if(!PHONE.test(value))return false;
  const digits=value.replace(/\D/g,'').length;
  return digits>=8&&digits<=15;
}
function contactEmail(value){
  if(!value)return true;
  if(value!==value.trim()||value.length>254||value.includes('..')||!EMAIL.test(value))return false;
  const [local,host]=value.split('@');
  return local.length<=64&&host.length<=253&&
    host.split('.').every(label=>label.length>0&&label.length<=63&&
      !label.startsWith('-')&&!label.endsWith('-'));
}
function validText(value,min,max){
  return typeof value==='string'&&value.length>=min&&value.length<=max&&
    !CONTROLS.test(value)&&!/[<>]/.test(value);
}
/**
 * Pass ONLY fabricated test objects from CI. It deliberately never
 * produces a normalized draft, session, consent or network request.
 */
export function assessPrivateBudgetPreview(input){
  try{
    if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.getPrototypeOf(input)!==Object.prototype)return outcome('INVALID_SHAPE');
    const descriptors=Object.getOwnPropertyDescriptors(input);
    if(Reflect.ownKeys(input).length!==FIELDS.length||
       !FIELDS.every(k=>Object.hasOwn(descriptors,k)&&
         descriptors[k].enumerable&&Object.hasOwn(descriptors[k],'value')))
      return outcome('INVALID_SHAPE');
    const draft=Object.fromEntries(FIELDS.map(k=>[k,descriptors[k].value]));
    if(draft.previewUnderstanding!==true)
      return outcome('PREVIEW_ACKNOWLEDGEMENT_REQUIRED');
    if(!validText(draft.name,3,120)||!validText(draft.role,0,120)||
       !validText(draft.email,0,254)||!validText(draft.phone,0,40)||
       !validText(draft.mobile,0,40)||!validText(draft.details,10,1600)||
       !validText(draft.challengePreview,0,3))
      return outcome('INVALID_FIELD_FORMAT');
    if(!SERVICE_SLUGS.has(draft.serviceSlug))return outcome('UNRECOGNIZED_SERVICE');
    if(!contactEmail(draft.email)||!contactPhone(draft.phone)||
       !contactPhone(draft.mobile)||(!draft.email&&!draft.phone&&!draft.mobile))
      return outcome('INVALID_CONTACT_ROUTE');
    // CRM F3-06 approximation: structural candidate only, not a legal grant.
    // Phone/mobile choices are not an approved mapping: never infer receipt.
    const minimum=inspectSyntheticImagineSiteFormMinimum({
      name:draft.name,email:draft.email||null,
      phone:draft.phone||draft.mobile||null
    });
    return outcome(minimum.meetsStructuralMinimum
      ?'STRUCTURAL_PREVIEW_ONLY_NO_AUTHORITY':'CRM_MINIMUM_MISMATCH',
      minimum.meetsStructuralMinimum);
  }catch{
    // Even hostile proxies/getters cannot turn input into an accepted lead.
    return outcome('INVALID_SHAPE');
  }
}
