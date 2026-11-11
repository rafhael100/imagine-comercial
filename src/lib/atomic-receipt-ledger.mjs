/**
 * F41 — offline contract for atomic replay reservation.
 * The ledger adapter is synthetic; it must be replaced by a durable DB with
 * uniqueness and a transaction before any operational use.
 */
import {verifyIndependentDeliveryReceipt} from './independent-delivery-receipt.mjs';
const NONCE=/^[0-9a-f]{64}$/;
const KEY=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

export async function verifyReceiptWithAtomicReplayLedger({
  receipt,expected,witnessKeys,publisherKeyId,nowSeconds,ledger
}={}){
  if(!ledger || typeof ledger.reserveOnce!=='function')
    throw new Error('atomic receipt: transactional replay ledger adapter required');
  // F39 does cryptographic checks before touching a durable reservation.
  const verified=verifyIndependentDeliveryReceipt({
    receipt,expected,witnessKeys,publisherKeyId,nowSeconds,seenNonces:new Set()
  });
  if(typeof verified.witnessKeyId!=='string'||!KEY.test(verified.witnessKeyId)||
    typeof receipt.nonce!=='string'||!NONCE.test(receipt.nonce))
    throw new Error('atomic receipt: invalid nonce identity');
  let reserved;
  try{
    // Production must implement INSERT ... ON CONFLICT DO NOTHING with a
    // unique (witnessKeyId, nonce) constraint; no check-then-set.
    reserved=await ledger.reserveOnce({
      witnessKeyId:verified.witnessKeyId,nonce:receipt.nonce,
      issuedAt:receipt.issuedAt,releaseId:verified.releaseId
    });
  }catch{
    throw new Error('atomic receipt: ledger unavailable, fail closed');
  }
  if(reserved!==true)
    throw new Error(reserved===false?'atomic receipt: replay rejected':
      'atomic receipt: ledger returned invalid acknowledgement');
  return Object.freeze({
    status:'ATOMIC_REPLAY_CONTRACT_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
    releaseId:verified.releaseId,target:verified.target,
    treeSha256:verified.treeSha256,witnessKeyId:verified.witnessKeyId,
    verified:true,replayReserved:true,deploymentAuthorized:false
  });
}
/** Single-process synthetic adapter ONLY for tests. */
export function createSyntheticAtomicLedger(){
  const seen=new Set();
  return Object.freeze({
    async reserveOnce({witnessKeyId,nonce}){
      const key=witnessKeyId+':'+nonce;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    }
  });
}
