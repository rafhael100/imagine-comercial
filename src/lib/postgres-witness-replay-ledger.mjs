/**
 * F49 — PostgreSQL-backed replay reservation adapter, not a DB connection.
 *
 * A trusted caller injects a minimally privileged pg-compatible client.
 * The UNIQUE (witness_key_id, nonce) index in the reviewed migration is
 * REQUIRED for cross-process atomicity. The adapter never creates schema,
 * connects to a remote server, or authorizes any publication.
 */
const HEX=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
export const INSERT_WITNESS_NONCE_SQL=`
INSERT INTO imagine_comercial_witness_replay_nonce
  (witness_key_id, nonce, issued_at, release_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (witness_key_id, nonce) DO NOTHING
RETURNING witness_key_id, nonce
`.trim();

function validReservation(value){
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype&&
    Object.keys(value).length===4&&
    ['witnessKeyId','nonce','issuedAt','releaseId'].every(key=>Object.hasOwn(value,key))&&
    typeof value.witnessKeyId==='string'&&ID.test(value.witnessKeyId)&&
    typeof value.nonce==='string'&&HEX.test(value.nonce)&&
    Number.isSafeInteger(value.issuedAt)&&value.issuedAt>0&&
    typeof value.releaseId==='string'&&ID.test(value.releaseId);
}

export function createPostgresWitnessReplayLedger(db){
  if(!db||typeof db.query!=='function')
    throw new Error('postgres replay: pg-compatible query client required');
  return Object.freeze({
    async reserveOnce(record){
      if(!validReservation(record))
        throw new Error('postgres replay: invalid signed receipt reservation');
      // PostgreSQL enforces uniqueness atomically. Never SELECT before INSERT.
      const result=await db.query(INSERT_WITNESS_NONCE_SQL,[
        record.witnessKeyId,record.nonce,record.issuedAt,record.releaseId
      ]);
      if(!result||!Array.isArray(result.rows)||!Number.isSafeInteger(result.rowCount))
        throw new Error('postgres replay: invalid database acknowledgement');
      if(result.rowCount===0&&result.rows.length===0)return false;
      if(result.rowCount===1&&result.rows.length===1&&
        result.rows[0]?.witness_key_id===record.witnessKeyId&&
        result.rows[0]?.nonce===record.nonce)return true;
      throw new Error('postgres replay: inconsistent database acknowledgement');
    }
  });
}
