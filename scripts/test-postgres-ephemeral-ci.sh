#!/usr/bin/env bash
# F51: PostgreSQL REAL, but exclusively a throwaway database on GitHub's
# hosted CI runner. No Leaseweb access, secret, deployment or live migration.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_ENVIRONMENT:-}" != "github-hosted" || "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ]]; then
  echo "F51 refuses execution outside the explicitly gated hosted CI runner." >&2
  exit 2
fi
if [[ -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F51 refuses externally configured PostgreSQL hosts." >&2
  exit 2
fi
database=imagine_comercial_ci
role=imagine_comercial_ci_writer
sudo systemctl start postgresql.service
# GitHub hosted runners have a fresh PostgreSQL instance. Refuse to touch
# any database that already exists, even in CI.
if sudo -u postgres psql -XqAt -v ON_ERROR_STOP=1 -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${database}'" | grep -q '^1$'; then
  echo "F51 refuses to reuse an existing database." >&2
  exit 2
fi
if sudo -u postgres psql -XqAt -v ON_ERROR_STOP=1 -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname = '${role}'" | grep -q '^1$'; then
  echo "F51 refuses to reuse an existing database role." >&2
  exit 2
fi
cleanup(){
  # Only remove this CI-only name, never a general database or cluster.
  sudo -u postgres dropdb --if-exists "${database}" >/dev/null 2>&1 || true
  sudo -u postgres dropuser --if-exists imagine_comercial_lead_ci_a >/dev/null 2>&1 || true
  sudo -u postgres dropuser --if-exists imagine_comercial_lead_ci_b >/dev/null 2>&1 || true
  sudo -u postgres dropuser --if-exists imagine_comercial_ci_execute_only >/dev/null 2>&1 || true
  sudo -u postgres dropuser --if-exists "${role}" >/dev/null 2>&1 || true
}
trap cleanup EXIT
sudo -u postgres createdb "${database}"
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -f db/migrations/001-witness-replay-nonce.sql
# Ensure the schema is idempotent in a private fresh CI database.
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -f db/migrations/001-witness-replay-nonce.sql
# F54: independent signed-policy floor, also restricted to the disposable DB.
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -f db/migrations/002-witness-policy-floor.sql
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -f db/migrations/002-witness-policy-floor.sql
# F55: definer functions only on this disposable CI database.
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -f db/migrations/003-execute-only-policy-floor.sql
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" <<'SQL'
CREATE ROLE imagine_comercial_ci_writer NOLOGIN;
GRANT USAGE ON SCHEMA public TO imagine_comercial_ci_writer;
GRANT INSERT (witness_key_id,nonce,issued_at,release_id)
  ON imagine_comercial_witness_replay_nonce TO imagine_comercial_ci_writer;
GRANT SELECT (witness_key_id,nonce)
  ON imagine_comercial_witness_replay_nonce TO imagine_comercial_ci_writer;
-- Least privilege for monotonic upsert and CAS, no DELETE/TRUNCATE rights.
GRANT INSERT (signer_key_id,witness_key_id,sequence,policy_sha256)
  ON imagine_comercial_witness_policy_floor TO imagine_comercial_ci_writer;
GRANT UPDATE (sequence,policy_sha256,updated_at)
  ON imagine_comercial_witness_policy_floor TO imagine_comercial_ci_writer;
GRANT SELECT (signer_key_id,witness_key_id,sequence,policy_sha256)
  ON imagine_comercial_witness_policy_floor TO imagine_comercial_ci_writer;
-- F55: isolated role with zero direct table access; function EXECUTE only.
CREATE ROLE imagine_comercial_ci_execute_only NOLOGIN;
GRANT USAGE ON SCHEMA public TO imagine_comercial_ci_execute_only;
REVOKE CREATE ON SCHEMA public FROM imagine_comercial_ci_execute_only;
GRANT EXECUTE ON FUNCTION public.imagine_comercial_promote_witness_policy(
  text,text,bigint,text) TO imagine_comercial_ci_execute_only;
GRANT EXECUTE ON FUNCTION public.imagine_comercial_reserve_witness_nonce(
  text,text,bigint,text,text,bigint,text) TO imagine_comercial_ci_execute_only;
SQL
node scripts/test-postgres-real-ci.mjs
# F55: prove execute-only role can run signed policies but cannot query
# protected tables or change their contents directly.
node scripts/test-postgres-execute-only-ci.mjs
# F85: real concurrent CAS and RLS test with ONLY six synthetic UUID references;
# SQL remains under tests/sql and is never a production migration.
bash scripts/test-lead-metadata-postgres-ephemeral-ci.sh
# F86: atomic PostgreSQL reservation + PENDING outbox in the same CI-only database.
bash scripts/test-lead-outbox-postgres-ephemeral-ci.sh
# F53: in the same disposable database, validate a real compiled Astro tree,
# catalog signature, witness policy/receipt and the PostgreSQL uniqueness
# constraint. The signed build test restores its original editorial dist.
npm ci --no-audit --no-fund
npm run build
node scripts/test-build-catalog.mjs
# Policy state must never be deletable by the restricted application role.
if sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -c   'SET ROLE imagine_comercial_ci_writer; DELETE FROM imagine_comercial_witness_policy_floor;' >/dev/null 2>&1; then
  echo "F54 failed: restricted role can DELETE policy floor." >&2
  exit 1
fi
# All these negative probes must fail with SQL permission errors, not
# merely with a row constraint: the execute-only role has zero table grants.
# F55: execute-only role must not read or modify raw security tables.
for statement in   'SELECT * FROM public.imagine_comercial_witness_policy_floor;'   'SELECT * FROM public.imagine_comercial_witness_replay_nonce;'   "UPDATE public.imagine_comercial_witness_policy_floor SET sequence=1;"   'DELETE FROM public.imagine_comercial_witness_policy_floor;'   'DELETE FROM public.imagine_comercial_witness_replay_nonce;' \
  "INSERT INTO public.imagine_comercial_witness_policy_floor (signer_key_id,witness_key_id,sequence,policy_sha256) VALUES ('root_f57_ci_01','witness_f57_ci_01',1,repeat('a',64));" \
  "INSERT INTO public.imagine_comercial_witness_replay_nonce (witness_key_id,nonce,issued_at,release_id) VALUES ('witness_f57_ci_01',repeat('b',64),1800000000,'release_f57_ci_01');" \
  'TRUNCATE public.imagine_comercial_witness_policy_floor;' \
  'TRUNCATE public.imagine_comercial_witness_replay_nonce;'
do
  if sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -c     "SET ROLE imagine_comercial_ci_execute_only; ${statement}" >/dev/null 2>&1; then
    echo "F55 failed: execute-only role accessed a protected table." >&2
    exit 1
  fi
done
# A write-only reservation role must never be able to delete the ledger.
if sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "${database}" -c   'SET ROLE imagine_comercial_ci_writer; DELETE FROM imagine_comercial_witness_replay_nonce;' >/dev/null 2>&1; then
  echo "F51 failed: restricted role can DELETE witness ledger." >&2
  exit 1
fi
echo "F51: PostgreSQL real, UNIQUE cross-process, replay and least-privilege checks PASS (ephemeral CI only)."
