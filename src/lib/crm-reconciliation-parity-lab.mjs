/**
 * F93 — Mirror the CRM PHP SyntheticLeadReconciliationInspector (F3-09).
 * Reads ONLY synthetic metadata. Does not assert delivery, authorize retry,
 * delete a temporary payload or acknowledge a visitor; it performs NO I/O.
 *
 * The CRM class compares the logical 3 UUIDs (org, binding, submission) here,
 * not site/form/destination. Verify those pinned fields separately (F78/F80).
 */
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const nil='00000000-0000-0000-0000-000000000000';
const statuses=new Set(['unknown','durable_claimed','failure_claimed','expired_claimed']);
const keys=['organization_reference','binding_reference','submission_reference'];

function plain(x){
  return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
    Object.getPrototypeOf(x)===Object.prototype;
}
function exactKeys(x,wanted){
  return plain(x)&&Object.keys(x).length===wanted.length&&
    wanted.every(key=>Object.hasOwn(x,key));
}
function identity(x){
  if(!exactKeys(x,keys)||keys.some(key=>typeof x[key]!=='string'||
     !uuid.test(x[key])||x[key].toLowerCase()===nil))return null;
  return keys.map(key=>x[key].toLowerCase()).join('|');
}
function observation(x){
  if(!exactKeys(x,['route','identity','status'])||
     !['primary','contingency'].includes(x.route)||
     !statuses.has(x.status))return null;
  const id=identity(x.identity);
  return id===null?null:{route:x.route,status:x.status,logicalIdentity:id};
}
function result(reasonCode){
  return Object.freeze({
    schema:'imagine.comercial.crm-reconciliation-parity.v1',
    mode:'SYNTHETIC_UNVERIFIED_RECEIVER_OBSERVATIONS',
    reasonCode,
    canMarkDelivered:false,canScheduleRetry:false,
    canDeleteTemporaryPayload:false,canAcknowledgeVisitor:false,
    tenantAuthorized:false,crmPersistenceProven:false,
    deploymentAuthorized:false
  });
}

/**
 * Input fields mirror CRM F3-09's inspection parameters, plus strict JSON
 * validation. Malformed input returns a negative diagnostic only.
 */
export function inspectSyntheticCrmReconciliationLab(input={}){
  if(!exactKeys(input,[
    'expected','primary','contingency','crmDeliveredClaimed','lateCrmReplyClaimed'
  ])||typeof input.crmDeliveredClaimed!=='boolean'||
     typeof input.lateCrmReplyClaimed!=='boolean')
    return result('OBSERVATION_STRUCTURE_INVALID');
  const expected=identity(input.expected);
  const primary=observation(input.primary);
  const secondary=observation(input.contingency);
  if(expected===null||primary===null||secondary===null)
    return result('OBSERVATION_STRUCTURE_INVALID');
  if(primary.logicalIdentity!==expected||secondary.logicalIdentity!==expected||
     primary.logicalIdentity!==secondary.logicalIdentity)
    return result('SUBMISSION_IDENTITY_CONFLICT');
  if(primary.route!=='primary'||secondary.route!=='contingency')
    return result('RECEIVER_ROLE_CONFLICT');

  const a=primary.status,b=secondary.status;
  const anyExpired=a==='expired_claimed'||b==='expired_claimed';
  const anyDurable=a==='durable_claimed'||b==='durable_claimed';
  const anyFailed=a==='failure_claimed'||b==='failure_claimed';

  // Match the precise PHP F3-09 decision precedence.
  if(input.lateCrmReplyClaimed&&anyExpired)
    return result('LATE_REPLY_EXPIRY_CONFLICT');
  if(input.lateCrmReplyClaimed)
    return result('LATE_REPLY_REVIEW_REQUIRED');
  if(anyExpired&&input.crmDeliveredClaimed)
    return result('DELIVERY_EXPIRY_CONFLICT');
  if(anyExpired&&anyDurable)
    return result('RECEIVER_EXPIRY_CONFLICT');
  if(anyExpired)
    return result('EXPIRY_RECONCILIATION_REQUIRED');
  if(input.crmDeliveredClaimed)
    return result('CRM_PERSISTENCE_PROOF_REQUIRED');
  if(a==='durable_claimed'&&b==='durable_claimed')
    return result('DUAL_RECEIVER_CLAIMS_REVIEW');
  if(anyDurable)
    return result('DURABLE_CLAIM_UNVERIFIED');
  if(a==='failure_claimed'&&b==='failure_claimed')
    return result('BOTH_RECEIVERS_FAILED_CLAIMED');
  if(anyFailed)
    return result('RECEIVER_FAILURE_CLAIMED');
  return result('NO_VERIFIED_RECEIPT');
}
