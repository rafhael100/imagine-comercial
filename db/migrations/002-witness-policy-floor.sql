-- F54: persistent monotonic trust-policy floor, proposed for manually reviewed staging.
-- CI can apply ONLY to the dedicated disposable imagine_comercial_ci database.
-- No automatic migration of a persistent or production PostgreSQL instance.
BEGIN;
CREATE TABLE IF NOT EXISTS imagine_comercial_witness_policy_floor (
  signer_key_id text NOT NULL CHECK
    (signer_key_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
  witness_key_id text NOT NULL CHECK
    (witness_key_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
  sequence bigint NOT NULL CHECK (sequence > 0 AND sequence <= 9007199254740991),
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT imagine_comercial_witness_policy_floor_pk
    PRIMARY KEY (signer_key_id,witness_key_id)
);
COMMIT;
-- A higher authenticated policy always supersedes a lower one.
-- Same sequence with different digest is a conflict (signer equivocation).
-- Do not truncate/restore older floors without a separate safety review.
