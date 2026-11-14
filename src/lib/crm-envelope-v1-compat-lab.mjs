/**
 * F78 — Comercial mirrors the CRM F3-11 *synthetic metadata-only* envelope.
 * Reference: imagine-crm/app/Core/Leads/SyntheticLeadEnvelopeV1Inspector.php
 * This is NOT a wire format, consent proof, authorization, or delivery ACK.
 * Keep source review independent; never bind a real tenant from browser input.
 */
const required=Object.freeze([
  'protocol','schema_version','organization_reference','binding_reference',
  'submission_reference','site_reference','form_reference','destination_reference'
]);
const referenceKeys=required.slice(2);
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const nil='00000000-0000-0000-0000-000000000000';
const modes=Object.freeze({
  STRUCTURE_ONLY_UNVERIFIED:true,
  ENVELOPE_STRUCTURE_INVALID:false,
  PROTOCOL_UNSUPPORTED:false,
  VERSION_UNSUPPORTED:false,
  REFERENCE_FORMAT_INVALID:false
});

function result(reasonCode){
  if(!Object.hasOwn(modes,reasonCode))throw new Error('F78: invalid assessment');
  return Object.freeze({
    reasonCode,
    isStructurallyCompatible:modes[reasonCode],
    canAcceptSubmission:false,
    canAcknowledgeDurableReceipt:false,
    canDeliverToCrm:false
  });
}

export const CRM_ENVELOPE_V1_KEYS=required;
export function inspectSyntheticCrmEnvelopeV1(candidate){
  if(candidate===null||typeof candidate!=='object'||Array.isArray(candidate)||
     Object.getPrototypeOf(candidate)!==Object.prototype||
     Object.keys(candidate).length!==required.length||
     !required.every(k=>Object.hasOwn(candidate,k)))
    return result('ENVELOPE_STRUCTURE_INVALID');
  if(candidate.protocol!=='imagine.lead-intake')
    return result('PROTOCOL_UNSUPPORTED');
  if(!Number.isInteger(candidate.schema_version)||candidate.schema_version!==1)
    return result('VERSION_UNSUPPORTED');
  for(const key of referenceKeys){
    const v=candidate[key];
    if(typeof v!=='string'||!uuid.test(v)||v.toLowerCase()===nil)
      return result('REFERENCE_FORMAT_INVALID');
  }
  return result('STRUCTURE_ONLY_UNVERIFIED');
}
