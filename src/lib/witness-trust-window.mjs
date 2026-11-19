/**
 * F44 — trust-window guard before offline witness receipt verification.
 * The caller must obtain the policy from a trusted, independent source.
 * These pure checks are NOT certificate management, remote attestation,
 * proof of publication or production authorization.
 */
import {verifyReceiptWithAtomicReplayLedger} from './atomic-receipt-ledger.mjs';
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
function record(v,fields){
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&
   Object.getPrototypeOf(v)===Object.prototype &&
   Object.keys(v).length===fields.length &&
   Object.keys(v).every(k=>fields.includes(k));
}
export async function verifyReceiptWithWitnessTrustWindow({
 receipt,expected,policy,publisherKeyId,nowSeconds,ledger
}={}){
 const fields=['schema','witnessKeyId','publicKeyPem','state','validFrom','validUntil'];
 if(!record(policy,fields)||
    policy.schema!=='imagine.comercial.witness-trust-window.v1'||
    typeof policy.witnessKeyId!=='string'||!ID.test(policy.witnessKeyId)||
    typeof policy.publicKeyPem!=='string'||policy.publicKeyPem.length>8192||
    !['active','revoked','suspended'].includes(policy.state)||
    !Number.isSafeInteger(policy.validFrom)||policy.validFrom<=0||
    !Number.isSafeInteger(policy.validUntil)||policy.validUntil<=policy.validFrom)
   throw new Error('witness trust: invalid independently sourced trust policy');
 if(policy.state!=='active')
   throw new Error('witness trust: key is inactive or revoked');
 if(!record(expected,['releaseId','target','treeSha256','witnessKeyId'])||
    expected.witnessKeyId!==policy.witnessKeyId||
    !record(receipt,['schema','releaseId','target','treeSha256','witnessKeyId','issuedAt','nonce','signature'])||
    receipt.witnessKeyId!==policy.witnessKeyId)
   throw new Error('witness trust: key identity mismatch');
 if(!Number.isSafeInteger(nowSeconds)||nowSeconds<=0||
    !Number.isSafeInteger(receipt.issuedAt)||
    receipt.issuedAt<policy.validFrom||receipt.issuedAt>=policy.validUntil||
    nowSeconds<policy.validFrom||nowSeconds>=policy.validUntil)
   throw new Error('witness trust: timestamp outside active key window');
 const result=await verifyReceiptWithAtomicReplayLedger({
   receipt,expected,publisherKeyId,nowSeconds,ledger,
   witnessKeys:new Map([[policy.witnessKeyId,policy.publicKeyPem]])
 });
 return Object.freeze({
   schema:'imagine.comercial.trust-window-receipt-review.v1',
   status:'WITNESS_TRUST_WINDOW_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
   releaseId:result.releaseId,target:result.target,
   treeSha256:result.treeSha256,witnessKeyId:result.witnessKeyId,
   replayReserved:true,deploymentAuthorized:false
 });
}
