/**
 * F45 — verify a trust-root-signed witness policy before accepting an F44
 * receipt. Offline review only; the release orchestrator must independently
 * supply root public keys and a monotonic minimum policy sequence.
 */
import {createPublicKey, verify as verifySignature} from 'node:crypto';
import {verifyReceiptWithWitnessTrustWindow} from './witness-trust-window.mjs';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const policyFields=['schema','witnessKeyId','publicKeyPem','state','validFrom','validUntil'];
const envelopeFields=['schema','signerKeyId','sequence','policy','signature'];
function exact(value,fields){
 return value!==null && typeof value==='object' && !Array.isArray(value) &&
  Object.getPrototypeOf(value)===Object.prototype &&
  Object.keys(value).length===fields.length &&
  Object.keys(value).every(k=>fields.includes(k));
}
function validPolicy(policy){
 return exact(policy,policyFields) &&
  policy.schema==='imagine.comercial.witness-trust-window.v1' &&
  typeof policy.witnessKeyId==='string'&&ID.test(policy.witnessKeyId) &&
  typeof policy.publicKeyPem==='string'&&policy.publicKeyPem.length>0&&policy.publicKeyPem.length<=8192 &&
  ['active','suspended','revoked'].includes(policy.state) &&
  Number.isSafeInteger(policy.validFrom)&&policy.validFrom>0 &&
  Number.isSafeInteger(policy.validUntil)&&policy.validUntil>policy.validFrom;
}
export function witnessPolicySigningBytes({signerKeyId,sequence,policy}={}){
 if(typeof signerKeyId!=='string'||!ID.test(signerKeyId)||
    !Number.isSafeInteger(sequence)||sequence<=0||!validPolicy(policy))
   throw new Error('signed witness policy: invalid signing payload');
 return Buffer.from(JSON.stringify([
  'imagine.comercial.signed-witness-policy.v1',signerKeyId,sequence,
  ...policyFields.map(k=>policy[k])
 ]),'utf8');
}
function signatureBytes(signature){
 if(typeof signature!=='string'||!/^([A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(signature))
  throw new Error('signed witness policy: invalid signature encoding');
 const bytes=Buffer.from(signature,'base64');
 if(bytes.length!==64||bytes.toString('base64')!==signature)
  throw new Error('signed witness policy: noncanonical signature encoding');
 return bytes;
}
export function verifySignedWitnessPolicy({
 envelope,rootKeys,expectedRootKeyId,minSequence
}={}){
 if(!exact(envelope,envelopeFields)||
    envelope.schema!=='imagine.comercial.signed-witness-policy.v1')
  throw new Error('signed witness policy: exact envelope schema required');
 if(!(rootKeys instanceof Map)||typeof expectedRootKeyId!=='string'||
    !ID.test(expectedRootKeyId)||!rootKeys.has(expectedRootKeyId)||
    envelope.signerKeyId!==expectedRootKeyId||
    envelope.policy?.witnessKeyId===expectedRootKeyId)
  throw new Error('signed witness policy: independent trust root required');
 if(!Number.isSafeInteger(minSequence)||minSequence<=0||
    !Number.isSafeInteger(envelope.sequence)||envelope.sequence<minSequence)
  throw new Error('signed witness policy: stale or missing monotonic sequence');
 const bytes=witnessPolicySigningBytes(envelope);
 let key;
 try{
  key=createPublicKey(rootKeys.get(expectedRootKeyId));
  if(key.asymmetricKeyType!=='ed25519')throw new Error('wrong key type');
 }catch{throw new Error('signed witness policy: invalid root public key');}
 if(!verifySignature(null,bytes,key,signatureBytes(envelope.signature)))
  throw new Error('signed witness policy: invalid root signature');
 return Object.freeze({...envelope.policy});
}
export async function verifyReceiptWithSignedWitnessPolicy({
 receipt,expected,envelope,rootKeys,expectedRootKeyId,minSequence,
 publisherKeyId,nowSeconds,ledger
}={}){
 const policy=verifySignedWitnessPolicy({envelope,rootKeys,expectedRootKeyId,minSequence});
 const result=await verifyReceiptWithWitnessTrustWindow({
  receipt,expected,policy,publisherKeyId,nowSeconds,ledger
 });
 return Object.freeze({
  schema:'imagine.comercial.signed-witness-receipt-review.v1',
  status:'ROOT_SIGNED_WITNESS_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
  releaseId:result.releaseId,target:result.target,treeSha256:result.treeSha256,
  witnessKeyId:result.witnessKeyId,policySequence:envelope.sequence,
  replayReserved:true,deploymentAuthorized:false,deploymentPerformed:false
 });
}
