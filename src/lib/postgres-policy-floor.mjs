/**
 * F54 — PostgreSQL monotonic policy floor + nonce reservation as ONE SQL
 * statement. Cryptographic validation happens BEFORE DB mutation.
 *
 * Client is injected by trusted infrastructure. Never connects to any DB,
 * creates permissions or authorizes publication. The combined CTE is required
 * to stop an older signed active policy racing a newer revoked/rotated policy.
 */
import {createHash} from 'node:crypto';
import {verifySignedWitnessPolicy,witnessPolicySigningBytes,
  verifyReceiptWithSignedWitnessPolicy} from './signed-witness-trust-policy.mjs';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const HEX=/^[0-9a-f]{64}$/;
const fields=['witnessKeyId','nonce','issuedAt','releaseId'];
function exact(obj,names){
  return obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
    Object.getPrototypeOf(obj)===Object.prototype&&
    Object.keys(obj).length===names.length&&
    names.every(name=>Object.hasOwn(obj,name));
}
const policyParams=(envelope)=>({
  signerKeyId:envelope.signerKeyId,
  witnessKeyId:envelope.policy.witnessKeyId,
  sequence:envelope.sequence,
  policySha256:createHash('sha256').update(witnessPolicySigningBytes(envelope))
    .digest('hex')
});
function validPolicyParams(value){
  return exact(value,['signerKeyId','witnessKeyId','sequence','policySha256'])&&
    typeof value.signerKeyId==='string'&&ID.test(value.signerKeyId)&&
    typeof value.witnessKeyId==='string'&&ID.test(value.witnessKeyId)&&
    Number.isSafeInteger(value.sequence)&&value.sequence>0&&
    typeof value.policySha256==='string'&&HEX.test(value.policySha256);
}
function validReceipt(value){
  return exact(value,fields)&&
    typeof value.witnessKeyId==='string'&&ID.test(value.witnessKeyId)&&
    typeof value.nonce==='string'&&HEX.test(value.nonce)&&
    Number.isSafeInteger(value.issuedAt)&&value.issuedAt>0&&
    typeof value.releaseId==='string'&&ID.test(value.releaseId);
}

export const PROMOTE_SIGNED_POLICY_SQL=`
WITH floor_guard AS (
  INSERT INTO imagine_comercial_witness_policy_floor AS existing
    (signer_key_id,witness_key_id,sequence,policy_sha256)
  VALUES ($1,$2,$3,$4)
  ON CONFLICT (signer_key_id,witness_key_id) DO UPDATE
    SET sequence=EXCLUDED.sequence,
        policy_sha256=EXCLUDED.policy_sha256,
        updated_at=now()
  WHERE existing.sequence < EXCLUDED.sequence
     OR (existing.sequence=EXCLUDED.sequence
         AND existing.policy_sha256=EXCLUDED.policy_sha256)
  RETURNING witness_key_id
)
SELECT count(*) AS policy_ok FROM floor_guard
`.trim();

export const RESERVE_SIGNED_POLICY_NONCE_SQL=`
WITH floor_guard AS (
  INSERT INTO imagine_comercial_witness_policy_floor AS existing
    (signer_key_id,witness_key_id,sequence,policy_sha256)
  VALUES ($1,$2,$3,$4)
  ON CONFLICT (signer_key_id,witness_key_id) DO UPDATE
    SET sequence=EXCLUDED.sequence,
        policy_sha256=EXCLUDED.policy_sha256,
        updated_at=now()
  WHERE existing.sequence < EXCLUDED.sequence
     OR (existing.sequence=EXCLUDED.sequence
         AND existing.policy_sha256=EXCLUDED.policy_sha256)
  RETURNING witness_key_id
), nonce_guard AS (
  INSERT INTO imagine_comercial_witness_replay_nonce
    (witness_key_id,nonce,issued_at,release_id)
  SELECT $2,$5,$6,$7 FROM floor_guard
  ON CONFLICT (witness_key_id,nonce) DO NOTHING
  RETURNING witness_key_id
)
SELECT (SELECT count(*) FROM floor_guard) AS policy_ok,
       (SELECT count(*) FROM nonce_guard) AS receipt_inserted
`.trim();

function countValue(value){
  return value===1||value==='1'?1:value===0||value==='0'?0:null;
}
function assertReply(result,requiredFields){
  if(!result||result.rowCount!==1||!Array.isArray(result.rows)||
    result.rows.length!==1||!exact(result.rows[0],requiredFields))
    throw new Error('policy floor: invalid database acknowledgement');
  const vals=requiredFields.map(k=>countValue(result.rows[0][k]));
  if(vals.some(v=>v===null))
    throw new Error('policy floor: invalid database acknowledgement');
  return vals;
}
function validateDb(db){
  if(!db||typeof db.query!=='function')
    throw new Error('policy floor: independent PostgreSQL query client required');
}
function rejectPolicyFloor(){
  throw new Error('policy floor: stale sequence or conflicting policy digest');
}
export function createPostgresPolicyBoundReplayLedger(db,rawPolicyParams){
  validateDb(db);
  if(!validPolicyParams(rawPolicyParams))
    throw new Error('policy floor: invalid authenticated policy parameters');
  const params=Object.freeze({...rawPolicyParams});
  return Object.freeze({
    async reserveOnce(receipt){
      if(!validReceipt(receipt)||receipt.witnessKeyId!==params.witnessKeyId)
        throw new Error('policy floor: invalid receipt or witness identity');
      const row=await db.query(RESERVE_SIGNED_POLICY_NONCE_SQL,[
        params.signerKeyId,params.witnessKeyId,params.sequence,
        params.policySha256,receipt.nonce,receipt.issuedAt,receipt.releaseId
      ]);
      const [policyOk,inserted]=assertReply(row,['policy_ok','receipt_inserted']);
      if(policyOk===0){
        if(inserted!==0)throw new Error('policy floor: impossible acknowledgement');
        rejectPolicyFloor();
      }
      return inserted===1;
    }
  });
}
export async function promoteAuthenticatedSignedPolicy({
  db,envelope,rootKeys,expectedRootKeyId,minSequence
}={}){
  validateDb(db);
  // The signed policy can be revoked. Its sequence must still be persisted to
  // prevent later use of an old valid-but-revoked witness key.
  const policy=verifySignedWitnessPolicy({
    envelope,rootKeys,expectedRootKeyId,minSequence
  });
  const p=policyParams(envelope);
  const row=await db.query(PROMOTE_SIGNED_POLICY_SQL,[
    p.signerKeyId,p.witnessKeyId,p.sequence,p.policySha256
  ]);
  if(assertReply(row,['policy_ok'])[0]!==1)rejectPolicyFloor();
  return Object.freeze({
    state:policy.state,sequence:p.sequence,
    status:'SIGNED_POLICY_FLOOR_RECORDED_LAB_ONLY',
    deploymentAuthorized:false
  });
}
export async function verifyReceiptWithPostgresPolicyFloor({
  db,receipt,expected,envelope,rootKeys,expectedRootKeyId,
  minSequence,publisherKeyId,nowSeconds
}={}){
  validateDb(db);
  // First authenticate the POLICY. The receipt signature, validity window
  // and pinned release are rechecked by F45/F44/F39 before reserveOnce.
  verifySignedWitnessPolicy({envelope,rootKeys,expectedRootKeyId,minSequence});
  const ledger=createPostgresPolicyBoundReplayLedger(db,policyParams(envelope));
  return verifyReceiptWithSignedWitnessPolicy({
    receipt,expected,envelope,rootKeys,expectedRootKeyId,
    minSequence,publisherKeyId,nowSeconds,ledger
  });
}
