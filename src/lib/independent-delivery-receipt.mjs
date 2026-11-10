/**
 * F39 — independent transport receipt contract (OFFLINE LAB ONLY).
 * A receipt is a signed statement by a separate delivery witness, NOT evidence
 * of operational authority, a real upload, or permission to deploy.
 */
import {createPublicKey, verify as cryptoVerify} from 'node:crypto';

const HEX=/^[0-9a-f]{64}$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/;
const FIELDS=['schema','releaseId','target','treeSha256','witnessKeyId','issuedAt','nonce'];
const RECEIPT_FIELDS=[...FIELDS,'signature'];
function plain(value){
  return value!==null && typeof value==='object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value)===Object.prototype;
}
function exact(value,keys,label){
  if(!plain(value)||Object.keys(value).length!==keys.length||
    Object.keys(value).some(k=>!keys.includes(k)))
    throw new Error('delivery receipt: invalid '+label+' schema');
}
function validId(value){return typeof value==='string'&&ID.test(value);}
export function receiptSigningBytes(payload){
  exact(payload,FIELDS,'payload');
  if(payload.schema!=='imagine.comercial.delivery-receipt.v1' ||
     !validId(payload.releaseId) ||
     !['staging','production'].includes(payload.target) ||
     typeof payload.treeSha256!=='string'||!HEX.test(payload.treeSha256)||
     !validId(payload.witnessKeyId) ||
     !Number.isSafeInteger(payload.issuedAt)||payload.issuedAt<=0||
     typeof payload.nonce!=='string'||!HEX.test(payload.nonce))
    throw new Error('delivery receipt: invalid signed fields');
  return Buffer.from(JSON.stringify(FIELDS.map(field=>payload[field])),'utf8');
}
function signatureBytes(value){
  if(typeof value!=='string'||!/^([A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(value))
    throw new Error('delivery receipt: invalid signature encoding');
  const result=Buffer.from(value,'base64');
  if(result.length!==64||result.toString('base64')!==value)
    throw new Error('delivery receipt: invalid signature bytes');
  return result;
}
export function verifyIndependentDeliveryReceipt({
  receipt, expected, witnessKeys, publisherKeyId, nowSeconds, seenNonces
}={}){
  exact(receipt,RECEIPT_FIELDS,'receipt');
  if(!plain(expected)||!validId(expected.releaseId)||
    !['staging','production'].includes(expected.target)||
    typeof expected.treeSha256!=='string'||!HEX.test(expected.treeSha256)||
    !validId(expected.witnessKeyId))
    throw new Error('delivery receipt: independently trusted expectations required');
  if(!Number.isSafeInteger(nowSeconds)||nowSeconds<=0||
    !(seenNonces instanceof Set)||!(witnessKeys instanceof Map))
    throw new Error('delivery receipt: trusted clock, witness keys and replay ledger required');
  const {signature,...payload}=receipt;
  const bytes=receiptSigningBytes(payload);
  if(payload.releaseId!==expected.releaseId || payload.target!==expected.target ||
    payload.treeSha256!==expected.treeSha256 ||
    payload.witnessKeyId!==expected.witnessKeyId)
    throw new Error('delivery receipt: does not match independent release pin');
  if(payload.witnessKeyId===publisherKeyId||!validId(publisherKeyId)||
    !witnessKeys.has(payload.witnessKeyId))
    throw new Error('delivery receipt: distinct trusted witness required');
  // Maximum five minutes old; reject future-dated and stale receipts.
  if(payload.issuedAt>nowSeconds||nowSeconds-payload.issuedAt>300)
    throw new Error('delivery receipt: outside time window');
  const replayKey=payload.witnessKeyId+':'+payload.nonce;
  if(seenNonces.has(replayKey))throw new Error('delivery receipt: replay detected');
  let key;
  try{
    key=createPublicKey(witnessKeys.get(payload.witnessKeyId));
    if(key.asymmetricKeyType!=='ed25519')throw new Error('wrong key type');
  }catch{throw new Error('delivery receipt: invalid witness public key');}
  if(!cryptoVerify(null,bytes,key,signatureBytes(signature)))
    throw new Error('delivery receipt: invalid witness signature');
  seenNonces.add(replayKey); // caller must persist this ledger in a real implementation
  return Object.freeze({
    status:'SIGNED_RECEIPT_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
    releaseId:payload.releaseId,target:payload.target,
    treeSha256:payload.treeSha256,witnessKeyId:payload.witnessKeyId,
    verified:true,deploymentAuthorized:false
  });
}
