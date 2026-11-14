#!/usr/bin/env bash
# F86: temporary metadata-only outbox, in the fresh F51/F85 GitHub CI database.
# No customer payload, external hosts, background worker or delivery claims.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ||
      "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ||
      -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F86 refuses non-disposable or externally configured PostgreSQL." >&2
  exit 2
fi
db=imagine_comercial_ci
schema=imagine_comercial_lead_ci
a_role=imagine_comercial_lead_ci_a
b_role=imagine_comercial_lead_ci_b
a_org=11111111-1111-4111-8111-111111111111
binding=cccccccc-cccc-4ccc-8ccc-cccccccccccc
site=dddddddd-dddd-4ddd-8ddd-dddddddddddd
form=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
destination=ffffffff-ffff-4fff-8fff-ffffffffffff
good_submission=abababab-abab-4aba-8aba-abababababab
rollback_submission=cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd

psql_lab(){
  sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$db" -c "$1"
}
if [[ "$(psql_lab "SELECT 1 FROM pg_namespace WHERE nspname='${schema}'")" != "1" ]]; then
  echo "F86 requires F85's already-proven ephemeral schema." >&2
  exit 2
fi
if [[ "$(psql_lab "SELECT 1 FROM information_schema.tables
  WHERE table_schema='${schema}' AND table_name='metadata_outbox'")" == "1" ]]; then
  echo "F86 refuses to reuse an existing outbox table." >&2
  exit 2
fi
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/sql/lead-outbox-ephemeral.sql

# Only synthetic UUIDs may enter this database. No lead content is stored.
for id in "$good_submission" "$rollback_submission"; do
  psql_lab "SET ROLE ${a_role};
    INSERT INTO ${schema}.metadata_ledger
    (organization_reference,submission_reference,binding_reference,
     site_reference,form_reference,destination_reference)
    VALUES ('${a_org}','$id','${binding}',
            '${site}','${form}','${destination}');" >/dev/null
done

# An invalid queued event must roll back its metadata reservation because both
# operations run atomically inside a single PostgreSQL statement.
invalid="SET ROLE ${a_role};
WITH reserved AS (
  UPDATE ${schema}.metadata_ledger
  SET state='reserved',version=version+1
  WHERE organization_reference='${a_org}'
    AND submission_reference='${rollback_submission}'
    AND state='open' AND version=0
  RETURNING organization_reference,submission_reference
)
INSERT INTO ${schema}.metadata_outbox
  (organization_reference,submission_reference,event_kind)
SELECT organization_reference,submission_reference,'forged_sent'
FROM reserved RETURNING event_kind;"
if psql_lab "$invalid" >/dev/null 2>&1; then
  echo "F86 invalid event unexpectedly committed." >&2
  exit 1
fi
rollback_state=$(psql_lab "SET ROLE ${a_role};
  SELECT state||'|'||version FROM ${schema}.metadata_ledger
  WHERE organization_reference='${a_org}'
    AND submission_reference='${rollback_submission}';")
if [[ "$rollback_state" != "open|0" ]]; then
  echo "F86 failed to roll back reservation after rejected event." >&2
  exit 1
fi
if [[ "$(psql_lab "SET ROLE ${a_role}; SELECT count(*) FROM ${schema}.metadata_outbox;")" != "0" ]]; then
  echo "F86 failed attempt created an outbox event." >&2; exit 1
fi

# One SQL statement atomically reserves an open submission and records a
# PENDING event (not an ACK). A retry must create neither reservation nor event.
atomic="SET ROLE ${a_role};
WITH reserved AS (
  UPDATE ${schema}.metadata_ledger
  SET state='reserved',version=version+1
  WHERE organization_reference='${a_org}'
    AND submission_reference='${good_submission}'
    AND state='open' AND version=0
  RETURNING organization_reference,submission_reference
)
INSERT INTO ${schema}.metadata_outbox
  (organization_reference,submission_reference,event_kind)
SELECT organization_reference,submission_reference,'pending_review'
FROM reserved RETURNING event_kind;"
if [[ "$(psql_lab "$atomic")" != "pending_review" ]]; then
  echo "F86 expected one atomic pending-review event." >&2; exit 1
fi
if [[ -n "$(psql_lab "$atomic")" ]]; then
  echo "F86 retry enqueued the same logical event again." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${a_role};
 SELECT state||'|'||version FROM ${schema}.metadata_ledger
 WHERE organization_reference='${a_org}'
   AND submission_reference='${good_submission}';")" != "reserved|1" ]]; then
  echo "F86 atomic reservation state differs from the outbox event." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${a_role}; SELECT count(*) FROM ${schema}.metadata_outbox;")" != "1" ]]; then
  echo "F86 expected exactly one outbox event." >&2; exit 1
fi

# A different tenant cannot see or forge the enqueued event.
if [[ "$(psql_lab "SET ROLE ${b_role}; SELECT count(*) FROM ${schema}.metadata_outbox;")" != "0" ]]; then
  echo "F86 outbox RLS leaks across tenants." >&2; exit 1
fi
if psql_lab "SET ROLE ${b_role};
 INSERT INTO ${schema}.metadata_outbox
 (organization_reference,submission_reference,event_kind)
 VALUES ('${a_org}','${good_submission}','pending_review');" >/dev/null 2>&1; then
  echo "F86 cross-tenant forged event was allowed." >&2; exit 1
fi

# Physical UNIQUE constraint and FOREIGN KEY reject duplicate/missing events.
if psql_lab "SET ROLE ${a_role};
 INSERT INTO ${schema}.metadata_outbox
 (organization_reference,submission_reference,event_kind)
 VALUES ('${a_org}','${good_submission}','pending_review');" >/dev/null 2>&1; then
  echo "F86 duplicate outbox event accepted." >&2; exit 1
fi
if psql_lab "SET ROLE ${a_role};
 INSERT INTO ${schema}.metadata_outbox
 (organization_reference,submission_reference,event_kind)
 VALUES ('${a_org}','12121212-1212-4212-8212-121212121212','pending_review');" >/dev/null 2>&1; then
  echo "F86 orphan event accepted without metadata ledger." >&2; exit 1
fi
for statement in \
  "DELETE FROM ${schema}.metadata_outbox;" \
  "TRUNCATE ${schema}.metadata_outbox;" \
  "UPDATE ${schema}.metadata_outbox SET event_kind='forged_sent';"; do
  if psql_lab "SET ROLE ${a_role}; $statement" >/dev/null 2>&1; then
    echo "F86 application role has destructive or mutable outbox rights." >&2
    exit 1
  fi
done

if [[ "$(psql_lab "SELECT count(*) FROM information_schema.columns
  WHERE table_schema='${schema}' AND table_name='metadata_outbox';")" != "4" ]]; then
  echo "F86 outbox must contain only four metadata columns." >&2; exit 1
fi
echo "F86 PASS: real ephemeral PostgreSQL atomic reservation + pending outbox; rollback, RLS and replay verified. No CRM delivery."
