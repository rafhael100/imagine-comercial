/**
 * F42 - offline release-readiness inventory.
 *
 * This is a diagnostic policy engine, NOT an authority for production. Even
 * when all gates are marked reviewed, the returned decision is REVIEW_ONLY.
 * Inputs are human-supplied metadata, not independently authenticated proofs.
 */
export const RELEASE_GATES=Object.freeze([
  'staging-private-vps',
  'portal-authn-mfa-grants',
  'portal-outbox-remote-witness',
  'crm-durable-consent-privacy',
  'legacy-contact-intake-parity',
  'gsc-real-crawl-and-redirect-review',
  'content-brand-contacts-pricing',
  'legal-privacy-and-contracts',
  'security-accessibility-field-performance',
  'release-owner-explicit-approval'
]);
const ID=/^[a-z][a-z0-9-]{2,63}$/;
const EVIDENCE=/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:issues|pull|actions\/runs)\/[0-9]+$/;
function plainOwnData(x){
 if(x===null||typeof x!=='object'||Array.isArray(x)||
    Object.getPrototypeOf(x)!==Object.prototype)return false;
 return Reflect.ownKeys(x).every(key=>{
   if(typeof key!=='string')return false;
   const d=Object.getOwnPropertyDescriptor(x,key);
   return d?.enumerable===true&&Object.hasOwn(d,'value');
 });
}
function exactRecord(x,fields){
 return plainOwnData(x)&&Reflect.ownKeys(x).length===fields.length&&
   fields.every(key=>Object.hasOwn(x,key))&&
   Reflect.ownKeys(x).every(key=>fields.includes(key));
}
function safeArray(value,limit){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
    value.length>limit)return false;
 const names=Reflect.ownKeys(value);
 if(names.length!==value.length+1)return false;
 for(let i=0;i<value.length;i++){
   const d=Object.getOwnPropertyDescriptor(value,String(i));
   if(!d||d.enumerable!==true||!Object.hasOwn(d,'value'))return false;
 }
 return true;
}
export function evaluateLaunchReadiness(input={}){
 // F294: fail closed before reading any untrusted "approval" getter.
 if(!plainOwnData(input)||
    Reflect.ownKeys(input).some(key=>!['gates','requestedTarget'].includes(key)))
   throw new Error('readiness: invalid review input');
 const {gates=[],requestedTarget='production'}=input;
 if(requestedTarget!=='production'&&requestedTarget!=='staging')
   throw new Error('readiness: invalid target');
 if(!safeArray(gates,RELEASE_GATES.length))
   throw new Error('readiness: invalid gate inventory');
 const records=new Map();
 for(const item of gates){
   if(!exactRecord(item,['id','status','evidenceUrls'])||
     typeof item.id!=='string'||!ID.test(item.id)||
     !RELEASE_GATES.includes(item.id)||records.has(item.id)||
     !['pending','reviewed','blocked'].includes(item.status)||
     !safeArray(item.evidenceUrls,10)||
     !item.evidenceUrls.every(u=>typeof u==='string'&&EVIDENCE.test(u))||
     new Set(item.evidenceUrls).size!==item.evidenceUrls.length||
     (item.status==='reviewed'&&item.evidenceUrls.length===0))
     throw new Error('readiness: invalid, duplicate or unsupported gate record');
   records.set(item.id,item);
 }
 const details=RELEASE_GATES.map(id=>{
   const r=records.get(id);
   return Object.freeze({id,status:r?.status??'pending',
      evidenceUrls:Object.freeze([...(r?.evidenceUrls??[])])});
 });
 const unresolved=details.filter(x=>x.status!=='reviewed').map(x=>x.id);
 return Object.freeze({
   schema:'imagine.comercial.readiness-inventory.v1',
   target:requestedTarget,
   state:unresolved.length?'BLOCKED_REVIEW_ONLY':'ALL_DECLARED_REVIEWED_NOT_AUTHORIZED',
   unresolved:Object.freeze(unresolved),
   reviewedCount:RELEASE_GATES.length-unresolved.length,
   totalGates:RELEASE_GATES.length,
   deploymentAuthorized:false,
   deploymentPerformed:false,
   gates:Object.freeze(details)
 });
}
