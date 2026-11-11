/**
 * P0 F159 — private quote preview -> CRM metadata/CAS structural review.
 * Composes existing code, never constructs an organization or consent
 * proof from browser input. All identifiers are synthetic CI fixtures.
 * No network, persistence, logging, CRM ACK or personal data in result.
 */
import {assessPrivateBudgetPreview} from './private-budget-preflight.mjs';
import {inspectSyntheticCrmEnvelopeV1} from './crm-envelope-v1-compat-lab.mjs';
import {inspectSyntheticCrmCasPrecondition} from './crm-idempotency-cas-parity-lab.mjs';
import {reviewPortalCrmOperationalBoundary} from './portal-crm-operational-boundary.mjs';

function assessment(stage,reasonCode){
  return Object.freeze({
    schema:'imagine.comercial.private-budget-crm-review.v1',
    mode:'LAB_REVIEW_ONLY_NO_NETWORK',
    stage,reasonCode,
    structureOnly:true,
    browserTenantClaimsTrusted:false,
    legalConsentVerified:false,
    antiBotVerified:false,
    serverServiceIdentityVerified:false,
    durableReservationVerified:false,
    realCrmAcknowledgementVerified:false,
    canCreateContact:false,
    canCreateCrmLead:false,
    canAutoRetry:false,
    canAcknowledgeVisitor:false,
    canReplaceLegacyContactForm:false,
    canDeploy:false
  });
}
/**
 * No public HTTP handler should call this function. "Envelope" and snapshot
 * are fixture inputs here, not proof of trusted server-side provenance.
 * Even F80 ATOMIC_STORE_REQUIRED never means a SQL write occurred.
 */
export function reviewPrivateBudgetToCrmLab({
  privateDraft,envelope,storedSnapshot,expectedVersion
}={}){
  const operational=reviewPortalCrmOperationalBoundary();
  if(operational.canCollectPublicLeads||operational.canClaimDurableCrmReceipt||
    operational.canDeploy)
    return assessment('operational-gate','UNEXPECTED_OPERATIONAL_POLICY');
  const form=assessPrivateBudgetPreview(privateDraft);
  if(!form.structureMatches)
    return assessment('private-budget',form.code);
  let envelopeAssessment;
  try{envelopeAssessment=inspectSyntheticCrmEnvelopeV1(envelope);}
  catch{return assessment('crm-envelope','ENVELOPE_STRUCTURE_INVALID');}
  if(!envelopeAssessment.isStructurallyCompatible)
    return assessment('crm-envelope',envelopeAssessment.reasonCode);
  try{
    const cas=inspectSyntheticCrmCasPrecondition({
      stored:storedSnapshot,incoming:envelope,expectedVersion
    });
    return assessment('crm-idempotency',cas.reasonCode);
  }catch{
    return assessment('crm-idempotency','F80_SNAPSHOT_REJECTED');
  }
}
