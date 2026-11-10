/**
 * F55 — reduced PostgreSQL execution surface.
 *
 * The F54 verification pipeline remains unchanged: the caller injects a
 * pg-compatible client with only EXECUTE on the SECURITY DEFINER functions.
 * This wrapper maps exactly the two reviewed F54 SQL shapes to constrained
 * database functions, preserving parameter binding.
 */
import {
  PROMOTE_SIGNED_POLICY_SQL,RESERVE_SIGNED_POLICY_NONCE_SQL
} from './postgres-policy-floor.mjs';

export const EXECUTE_SIGNED_POLICY_PROMOTION_SQL=
  'SELECT policy_ok FROM public.imagine_comercial_promote_witness_policy($1,$2,$3,$4)';
export const EXECUTE_SIGNED_NONCE_RESERVATION_SQL=
  'SELECT policy_ok, receipt_inserted FROM public.imagine_comercial_reserve_witness_nonce($1,$2,$3,$4,$5,$6,$7)';

export function createExecuteOnlyPolicyFloorClient(db){
  if(!db||typeof db.query!=='function')
    throw new Error('execute-only policy floor: PostgreSQL query client required');
  return Object.freeze({
    async query(sql,params){
      if(sql===PROMOTE_SIGNED_POLICY_SQL){
        if(!Array.isArray(params)||params.length!==4)
          throw new Error('execute-only policy floor: invalid promotion parameters');
        return db.query(EXECUTE_SIGNED_POLICY_PROMOTION_SQL,params);
      }
      if(sql===RESERVE_SIGNED_POLICY_NONCE_SQL){
        if(!Array.isArray(params)||params.length!==7)
          throw new Error('execute-only policy floor: invalid reservation parameters');
        return db.query(EXECUTE_SIGNED_NONCE_RESERVATION_SQL,params);
      }
      throw new Error('execute-only policy floor: unauthorized SQL operation');
    }
  });
}
