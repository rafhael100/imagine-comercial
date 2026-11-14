/**
 * F79 — Mirror the *structural* CRM F3-06 Imagine Sites form minimum
 * (ImagineSiteFormMinimumInspector.php), without importing any public form.
 * This is a Node test approximation of PHP filter_var, NOT normative parity
 * for international email syntax, permission, consent, or real delivery.
 */
const EXACT_FIELDS=Object.freeze(['name','email','phone']);
const UNSAFE=/[\x00-\x1f\x7f]/;
const PHONE=/^\+?[0-9][0-9 ()-]{0,39}$/;
const EMAIL=/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

function result({namePresent,emailCandidateValid,phoneCandidateValid,invalidSuppliedContact}){
  return Object.freeze({
    mode:'STRUCTURAL_CRM_F3_06_APPROXIMATION_LAB_ONLY',
    namePresent,emailCandidateValid,phoneCandidateValid,invalidSuppliedContact,
    meetsStructuralMinimum:namePresent&&(emailCandidateValid||phoneCandidateValid)&&!invalidSuppliedContact,
    canDeliver:false,canStore:false,canAcknowledgeReceipt:false
  });
}
function validateDraftFields(draft){
  if(!draft||typeof draft!=='object'||Array.isArray(draft)||
     Object.getPrototypeOf(draft)!==Object.prototype||
     Object.keys(draft).length!==EXACT_FIELDS.length||
     !EXACT_FIELDS.every(key=>Object.hasOwn(draft,key)))
    throw new Error('F79: unsupported synthetic draft fields');
  for(const key of EXACT_FIELDS){
    const value=draft[key];
    if(value===null)continue;
    if(typeof value!=='string'||value.trim()===''||
       Buffer.byteLength(value,'utf8')>1024||UNSAFE.test(value))
      throw new Error('F79: invalid synthetic draft field');
  }
}
function isEmail(candidate){
  if(candidate===null||candidate!==candidate.trim()||candidate.length>254||
     candidate.includes('..')||!EMAIL.test(candidate))return false;
  const [local,domain]=candidate.split('@');
  return local.length<=64&&domain.length<=253&&
    domain.split('.').every(label=>label.length<=63&&!label.startsWith('-')&&!label.endsWith('-'));
}
function isPhone(candidate){
  if(candidate===null||!PHONE.test(candidate))return false;
  const length=candidate.replace(/\D/g,'').length;
  return length>=8&&length<=15;
}
export function inspectSyntheticImagineSiteFormMinimum(draft){
  validateDraftFields(draft);
  const namePresent=draft.name!==null&&draft.name.trim()!=='';
  const emailCandidateValid=isEmail(draft.email);
  const phoneCandidateValid=isPhone(draft.phone);
  return result({
    namePresent,emailCandidateValid,phoneCandidateValid,
    invalidSuppliedContact:
      (draft.email!==null&&!emailCandidateValid)||
      (draft.phone!==null&&!phoneCandidateValid)
  });
}
