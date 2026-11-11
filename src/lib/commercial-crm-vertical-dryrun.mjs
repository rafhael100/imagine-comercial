/**
 * F81 — End-to-end STRUCTURAL dry-run of existing synthetic contracts:
 * Comercial F30 -> CRM minimum F79 -> CRM envelope F78 -> CAS F80.
 * No form, API, storage, receipt, authorization or transport.
 * These stages do NOT validate consent provenance or tenant binding.
 */
import {validateSyntheticLeadDraft} from './lead-intake-lab.mjs';
import {inspectSyntheticImagineSiteFormMinimum}
  from './crm-form-minimum-parity-lab.mjs';
import {inspectSyntheticCrmEnvelopeV1}
  from './crm-envelope-v1-compat-lab.mjs';
import {inspectSyntheticCrmCasPrecondition}
  from './crm-idempotency-cas-parity-lab.mjs';

function decision(stage,reasonCode){
  return Object.freeze({
    schema:'imagine.comercial.synthetic-intake-dryrun.v1',
    mode:'OFFLINE_STRUCTURAL_REVIEW_ONLY',
    stage,reasonCode,
    consentProven:false,tenantBindingVerified:false,
    durableReservationProven:false,crmDeliveryProven:false,
    canSubmit:false,canAcknowledge:false,deploymentAuthorized:false
  });
}
/**
 * The input is ONLY a synthetic fixture supplied by unit tests.
 * Never expose this function as a public route or accept customer PII.
 */
export function reviewSyntheticCommercialCrmPath({
  draft,envelope,storedSnapshot,expectedVersion
}={}){
  let accepted;
  try{
    accepted=validateSyntheticLeadDraft(draft);
  }catch{
    return decision('commercial-draft','F30_DRAFT_REJECTED');
  }
  let minimum;
  try{
    minimum=inspectSyntheticImagineSiteFormMinimum({
      name:accepted.name,
      email:accepted.email,
      phone:accepted.phone===''?null:accepted.phone
    });
  }catch{
    return decision('crm-form-minimum','F79_MINIMUM_REJECTED');
  }
  if(!minimum.meetsStructuralMinimum)
    return decision('crm-form-minimum','F79_MINIMUM_REJECTED');
  const envelopeAssessment=inspectSyntheticCrmEnvelopeV1(envelope);
  if(!envelopeAssessment.isStructurallyCompatible)
    return decision('crm-envelope',envelopeAssessment.reasonCode);
  let cas;
  try{
    cas=inspectSyntheticCrmCasPrecondition({
      stored:storedSnapshot,incoming:envelope,expectedVersion
    });
  }catch{
    return decision('crm-idempotency','F80_SNAPSHOT_REJECTED');
  }
  // Even ATOMIC_STORE_REQUIRED is a diagnostic, never a reservation.
  return decision('crm-idempotency',cas.reasonCode);
}
