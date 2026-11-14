/**
 * F80 — CRM F3-12 CAS precondition matrix, independently mirrored in Node.
 * NO atomic operation, durable reservation, network, tenant verification,
 * signature, consent proof or downstream acknowledgment is performed.
 *
 * The CRM uses PHP_INT_MAX; the Node lab uses MAX_SAFE_INTEGER and thus
 * must not be used as a wire-level replacement for the PHP inspector.
 */
import {inspectSyntheticCrmEnvelopeV1} from './crm-envelope-v1-compat-lab.mjs';

const PHASES=Object.freeze([
  'open','reserved','outcome_unknown','delivered_claimed','expired_claimed'
]);
const REQUIRED=Object.freeze(['original','phase','version']);
const PINNED=Object.freeze([
  'binding_reference','site_reference','form_reference','destination_reference'
]);
const phaseStates=Object.freeze({
  reserved:'IN_FLIGHT_REVIEW',
  outcome_unknown:'UNKNOWN_OUTCOME_LOOKUP_REQUIRED',
  delivered_claimed:'DELIVERED_CLAIM_REVIEW',
  expired_claimed:'EXPIRED_CLAIM_REVIEW'
});

function report(reasonCode,proposedNextVersion=null){
  return Object.freeze({
    mode:'SYNTHETIC_CAS_PRECONDITION_ONLY',
    reasonCode,
    proposedNextVersion,
    canCommitReservation:false,
    canRetryDelivery:false,
    canCreateLead:false
  });
}
function validEnvelope(value){
  return inspectSyntheticCrmEnvelopeV1(value).isStructurallyCompatible;
}
function same(a,b,key){
  return a[key].toLowerCase()===b[key].toLowerCase();
}
function validateSnapshot(snapshot,incoming){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
     Object.getPrototypeOf(snapshot)!==Object.prototype||
     Object.keys(snapshot).length!==REQUIRED.length||
     !REQUIRED.every(key=>Object.hasOwn(snapshot,key))||
     !validEnvelope(snapshot.original)||!validEnvelope(incoming)||
     !PHASES.includes(snapshot.phase)||!Number.isSafeInteger(snapshot.version)||
     snapshot.version<0)
    throw new Error('F80: invalid untrusted synthetic snapshot or envelope');
}
/**
 * Mirrors CRM code ordering: scope -> pinned context -> expected version ->
 * stale version -> operation -> phase. Result is diagnostic only.
 */
export function inspectSyntheticCrmCasPrecondition({
  stored,incoming,expectedVersion,operation='reserve'
}={}){
  validateSnapshot(stored,incoming);
  if(!same(stored.original,incoming,'organization_reference')||
     !same(stored.original,incoming,'submission_reference'))
    return report('LOGICAL_SCOPE_MISMATCH');
  if(!PINNED.every(key=>same(stored.original,incoming,key)))
    return report('PINNED_CONTEXT_CONFLICT');
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)
    return report('VERSION_INVALID');
  if(stored.version!==expectedVersion)
    return report('STALE_SNAPSHOT_RECONCILE');
  if(operation!=='reserve')
    return report('OPERATION_NOT_SUPPORTED');
  if(stored.phase!=='open')return report(phaseStates[stored.phase]);
  if(stored.version===Number.MAX_SAFE_INTEGER)
    return report('VERSION_OVERFLOW');
  return report('ATOMIC_STORE_REQUIRED',stored.version+1);
}
