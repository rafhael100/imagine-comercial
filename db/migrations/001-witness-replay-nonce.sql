-- F49. Migration proposal for private PostgreSQL staging only.
-- DO NOT run automatically in CI, developer workstations or production.
-- Requires restricted application role and separately reviewed retention policy.
BEGIN;
CREATE TABLE IF NOT EXISTS imagine_comercial_witness_replay_nonce (
  witness_key_id text NOT NULL
    CHECK (witness_key_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
  nonce text NOT NULL
    CHECK (nonce ~ '^[0-9a-f]{64}$'),
  issued_at bigint NOT NULL CHECK (issued_at > 0),
  release_id text NOT NULL
    CHECK (release_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT imagine_comercial_witness_replay_nonce_pk
    PRIMARY KEY (witness_key_id, nonce)
);
COMMIT;
-- No automatic cleanup: retention/backup and recovery semantics must be approved.
-- Grant only INSERT + narrowly required RETURNING columns to the dedicated role.
-- Do not log full signed receipts or their originating customer/visitor data.
