-- F55: SECURITY DEFINER execute-only façade over F54 policy/nonce tables.
-- CI applies only in a brand-new disposable database. Persistent deployment
-- requires a reviewed DBA migration, isolated ownership and audited grants.
BEGIN;
CREATE OR REPLACE FUNCTION public.imagine_comercial_promote_witness_policy(
  in_signer text,in_witness text,in_seq bigint,in_digest text
) RETURNS TABLE(policy_ok integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
BEGIN
  IF in_signer IS NULL OR in_signer !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     OR in_witness IS NULL OR in_witness !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     OR in_seq IS NULL OR in_seq <= 0 OR in_seq > 9007199254740991
     OR in_digest IS NULL OR in_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid authenticated policy metadata' USING ERRCODE='22023';
  END IF;
  WITH floor_guard AS (
    INSERT INTO public.imagine_comercial_witness_policy_floor AS existing
      (signer_key_id,witness_key_id,sequence,policy_sha256)
    VALUES (in_signer,in_witness,in_seq,in_digest)
    ON CONFLICT (signer_key_id,witness_key_id) DO UPDATE
      SET sequence=EXCLUDED.sequence,
          policy_sha256=EXCLUDED.policy_sha256,
          updated_at=now()
    WHERE existing.sequence < EXCLUDED.sequence
       OR (existing.sequence=EXCLUDED.sequence
           AND existing.policy_sha256=EXCLUDED.policy_sha256)
    RETURNING 1
  )
  SELECT count(*)::integer INTO policy_ok FROM floor_guard;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.imagine_comercial_reserve_witness_nonce(
  in_signer text,in_witness text,in_seq bigint,in_digest text,
  in_nonce text,in_issued_at bigint,in_release text
) RETURNS TABLE(policy_ok integer,receipt_inserted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
BEGIN
  IF in_signer IS NULL OR in_signer !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     OR in_witness IS NULL OR in_witness !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     OR in_seq IS NULL OR in_seq <= 0 OR in_seq > 9007199254740991
     OR in_digest IS NULL OR in_digest !~ '^[0-9a-f]{64}$'
     OR in_nonce IS NULL OR in_nonce !~ '^[0-9a-f]{64}$'
     OR in_issued_at IS NULL OR in_issued_at <= 0
     OR in_release IS NULL OR in_release !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' THEN
    RAISE EXCEPTION 'invalid signed receipt reservation metadata' USING ERRCODE='22023';
  END IF;
  WITH floor_guard AS (
    INSERT INTO public.imagine_comercial_witness_policy_floor AS existing
      (signer_key_id,witness_key_id,sequence,policy_sha256)
    VALUES (in_signer,in_witness,in_seq,in_digest)
    ON CONFLICT (signer_key_id,witness_key_id) DO UPDATE
      SET sequence=EXCLUDED.sequence,
          policy_sha256=EXCLUDED.policy_sha256,
          updated_at=now()
    WHERE existing.sequence < EXCLUDED.sequence
       OR (existing.sequence=EXCLUDED.sequence
           AND existing.policy_sha256=EXCLUDED.policy_sha256)
    RETURNING witness_key_id
  ), nonce_guard AS (
    INSERT INTO public.imagine_comercial_witness_replay_nonce
      (witness_key_id,nonce,issued_at,release_id)
    SELECT in_witness,in_nonce,in_issued_at,in_release FROM floor_guard
    ON CONFLICT (witness_key_id,nonce) DO NOTHING
    RETURNING witness_key_id
  )
  SELECT (SELECT count(*)::integer FROM floor_guard),
         (SELECT count(*)::integer FROM nonce_guard)
  INTO policy_ok,receipt_inserted;
  RETURN NEXT;
END;
$$;

-- PostgreSQL defaults function EXECUTE to PUBLIC. Always revoke it.
REVOKE ALL ON FUNCTION public.imagine_comercial_promote_witness_policy(
  text,text,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.imagine_comercial_reserve_witness_nonce(
  text,text,bigint,text,text,bigint,text) FROM PUBLIC;
COMMIT;

-- A dedicated runtime role requires ONLY USAGE on schema and EXECUTE on these
-- functions. It MUST NOT receive direct table access, CREATE on public or
-- membership in the function-owner role. Keep functions postgres-owned.
-- The application must verify the Ed25519 root signature before invoking.
