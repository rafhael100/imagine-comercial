/**
 * F90: Node 22 verification LAB for the PHP CRM F3-15 synthetic HMAC contract.
 * Reference: imagine-crm/app/Core/Leads/SyntheticLeadReceiptMacInspector.php
 * This module verifies ONLY bytes given a CALLER-SUPPLIED fixture key. It does
 * NOT authenticate the key source, tenant, destination, payload or CRM receipt.
 * No network, storage, transport or real production keys. DO NOT serve publicly.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {inspectSyntheticCrmEnvelopeV1} from './crm-envelope-v1-compat-lab.mjs';

const domain='imagine.lead-intake.synthetic-receipt.v1';
const refs=Object.freeze([
  'organization_reference','binding_reference','submission_reference',
  'site_reference','form_reference','destination_reference'
]);
const noncePattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const signaturePattern=/^[0-9a-f]{64}$/;
const nilUuid='00000000-0000-0000-0000-000000000000';

function assessment(reasonCode){
  return Object.freeze({
    schema:'imagine.comercial.synthetic-crm-mac-inspection.v1',
    mode:'LAB_ONLY_UNTRUSTED_KEY_NO_PERSISTENCE',
    reasonCode,
    macMatchesFixture:reasonCode==='LAB_MAC_MATCH_UNTRUSTED',
    canAcceptLead:false,
    canAcknowledgeDurableReceipt:false,
    canDeliverToCrm:false,
    canTreatAsReplaySafe:false,
    tenantAuthorized:false,
    productionAuthorized:false
  });
}

function validEnvelope(envelope){
  return inspectSyntheticCrmEnvelopeV1(envelope).isStructurallyCompatible;
}
function validTime(issuedAt,expiresAt,now){
  return Number.isSafeInteger(issuedAt)&&Number.isSafeInteger(expiresAt)&&
    Number.isSafeInteger(now)&&issuedAt>0&&now>0&&
    expiresAt>issuedAt&&expiresAt-issuedAt<=300&&
    issuedAt<=now+30&&expiresAt>now;
}

/**
 * Metadata-only parity with PHP F3-15 ordering. Returns diagnostics without
 * the message, signature, nonce, key or any external references.
 */
export function inspectSyntheticCrmReceiptMac(input={}){
  const allowed=['expected','reported','issuedAt','expiresAt','now','nonce','signature','syntheticKey'];
  if(input===null||typeof input!=='object'||Array.isArray(input)||
     Object.getPrototypeOf(input)!==Object.prototype||
     Object.keys(input).length!==allowed.length||
     !allowed.every(key=>Object.hasOwn(input,key)))
    return assessment('CRYPTO_INPUT_INVALID');
  const {expected,reported,issuedAt,expiresAt,now,nonce,signature,syntheticKey}=input;
  // Validation of UUID strings is mandatory, but a correct UUID is never a
  // credential. Reject malformed/relabelled contexts before MAC comparison.
  if(!validEnvelope(expected)||!validEnvelope(reported)||
     !refs.every(key=>expected[key].toLowerCase()===reported[key].toLowerCase()))
    return assessment('PINNED_CONTEXT_MISMATCH');
  if(!validTime(issuedAt,expiresAt,now))
    return assessment('TIME_WINDOW_INVALID');
  if(typeof nonce!=='string'||!noncePattern.test(nonce)||nonce===nilUuid)
    return assessment('NONCE_FORMAT_INVALID');
  if(typeof signature!=='string'||!signaturePattern.test(signature)||
     typeof syntheticKey!=='string'||Buffer.byteLength(syntheticKey,'utf8')<32)
    return assessment('CRYPTO_INPUT_INVALID');

  const message=[
    domain,...refs.map(key=>reported[key].toLowerCase()),
    String(issuedAt),String(expiresAt),nonce
  ].join('\n');

  const computed=createHmac('sha256',syntheticKey).update(message,'utf8').digest();
  const provided=Buffer.from(signature,'hex');
  if(!timingSafeEqual(computed,provided))
    return assessment('MAC_MISMATCH');

  // A matching MAC can be replayed without an independent atomic nonce store,
  // and cannot confirm the CRM persisted anything.
  return assessment('LAB_MAC_MATCH_UNTRUSTED');
}
