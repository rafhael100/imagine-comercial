#!/usr/bin/env bash
# F87: CI-only lease and fencing verification in the disposable F51/F85/F86 DB.
# Simulated state "reconciled_lab" is NOT actual CRM delivery or receipt.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ||
      "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ||
      -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F87 refuses execution outside disposable GitHub-hosted PostgreSQL CI." >&2
  exit 2
fi
db=imagine_comercial_ci
schema=imagine_comercial_lead_ci
a_org=11111111-1111-4111-8111-111111111111
good_submission=abababab-abab-4aba-8aba-abababababab
worker_a=imagine_comercial_lead_ci_worker_a
worker_b=imagine_comercial_lead_ci_worker_b
psql_lab(){ sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$db" -c "$1"; }

if [[ "$(psql_lab "SELECT 1 FROM information_schema.tables
 WHERE table_schema='${schema}' AND table_name='metadata_outbox';")" != "1" ]]; then
  echo "F87 requires the disposable F86 outbox." >&2; exit 2
fi
if [[ "$(psql_lab "SELECT count(*) FROM pg_roles WHERE rolname IN
 ('${worker_a}','${worker_b}');")" != "0" ]]; then
  echo "F87 refuses to reuse worker roles." >&2; exit 2
fi
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/sql/lead-outbox-lease-ephemeral.sql

before=$(psql_lab "SET ROLE ${worker_a};
 SELECT state||'|'||claim_version||'|'||attempts FROM ${schema}.metadata_outbox
 WHERE organization_reference='${a_org}' AND submission_reference='${good_submission}';")
if [[ "$before" != "queued|0|0" ]]; then
  echo "F87 expected untouched queued outbox event, got $before." >&2; exit 1
fi

# Two competing connections try to claim the SAME row with CAS/row locks.
# Under PostgreSQL READ COMMITTED only one can update queued+version=0.
claim="SET ROLE ${worker_a};
 UPDATE ${schema}.metadata_outbox
 SET state='claimed',claim_version=claim_version+1,attempts=attempts+1,
     lease_until=transaction_timestamp()+interval '60 seconds'
 WHERE organization_reference='${a_org}'
   AND submission_reference='${good_submission}'
   AND event_kind='pending_review'
   AND state='queued' AND claim_version=0 AND attempts<3
 RETURNING claim_version;"
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
(psql_lab "$claim" > "$dir/worker1") & p1=$!
(psql_lab "$claim" > "$dir/worker2") & p2=$!
wait "$p1"
wait "$p2"
wins=$(cat "$dir/worker1" "$dir/worker2" | awk '$0=="1" {n++} END {print n+0}')
if [[ "$wins" != "1" ]]; then
  echo "F87 expected precisely one claim winner; got $wins." >&2; exit 1
fi
if [[ -n "$(psql_lab "$claim")" ]]; then
  echo "F87 duplicate claim succeeded during live lease." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a}; SELECT state||'|'||claim_version||'|'||attempts
 FROM ${schema}.metadata_outbox WHERE organization_reference='${a_org}'
 AND submission_reference='${good_submission}';")" != "claimed|1|1" ]]; then
  echo "F87 claim state mismatch." >&2; exit 1
fi

# Worker of tenant B cannot view/modify tenant A's claimed event.
if [[ "$(psql_lab "SET ROLE ${worker_b}; SELECT count(*) FROM ${schema}.metadata_outbox;")" != "0" ]]; then
  echo "F87 cross-tenant worker read succeeded." >&2; exit 1
fi
if [[ -n "$(psql_lab "SET ROLE ${worker_b};
 UPDATE ${schema}.metadata_outbox SET state='reconciled_lab',lease_until=NULL
 WHERE organization_reference='${a_org}' AND claim_version=1
 RETURNING claim_version;")" ]]; then
  echo "F87 cross-tenant worker update succeeded." >&2; exit 1
fi
# No worker may rewrite pinned event metadata.
for column in organization_reference submission_reference event_kind enqueued_at; do
  if psql_lab "SET ROLE ${worker_a}; UPDATE ${schema}.metadata_outbox
      SET $column=$column WHERE organization_reference='${a_org}';" >/dev/null 2>&1; then
    echo "F87 worker could modify immutable column $column." >&2; exit 1
  fi
done
for statement in \
  "DELETE FROM ${schema}.metadata_outbox;" \
  "TRUNCATE ${schema}.metadata_outbox;" \
  "INSERT INTO ${schema}.metadata_outbox
     (organization_reference,submission_reference,event_kind)
     VALUES ('${a_org}','${good_submission}','pending_review');"; do
  if psql_lab "SET ROLE ${worker_a}; $statement" >/dev/null 2>&1; then
    echo "F87 worker gained forbidden destructive or insertion rights." >&2; exit 1
  fi
done

# Simulate a crashed consumer by forcing the clock-defined lease into the past.
# This is test-harness-only privileged mutation, not worker authority.
psql_lab "UPDATE ${schema}.metadata_outbox
  SET lease_until=transaction_timestamp()-interval '1 second'
  WHERE organization_reference='${a_org}' AND submission_reference='${good_submission}';" >/dev/null

reclaim="SET ROLE ${worker_a};
 UPDATE ${schema}.metadata_outbox
 SET claim_version=claim_version+1,attempts=attempts+1,
     lease_until=transaction_timestamp()+interval '60 seconds'
 WHERE organization_reference='${a_org}'
   AND submission_reference='${good_submission}'
   AND state='claimed' AND lease_until < transaction_timestamp()
   AND claim_version=1 AND attempts<3
 RETURNING claim_version;"
if [[ "$(psql_lab "$reclaim")" != "2" ]]; then
  echo "F87 expired lease was not reclaimed with a new fencing version." >&2
  exit 1
fi
# A late worker holding fencing version 1 must NOT overwrite the new holder.
stale="SET ROLE ${worker_a};
 UPDATE ${schema}.metadata_outbox SET state='reconciled_lab',lease_until=NULL
 WHERE organization_reference='${a_org}'
   AND submission_reference='${good_submission}'
   AND state='claimed' AND claim_version=1
   AND lease_until > transaction_timestamp()
 RETURNING claim_version;"
if [[ -n "$(psql_lab "$stale")" ]]; then
  echo "F87 stale worker forged reconciliation after lease recovery." >&2
  exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT state||'|'||claim_version||'|'||attempts FROM ${schema}.metadata_outbox
 WHERE organization_reference='${a_org}' AND submission_reference='${good_submission}';")" != "claimed|2|2" ]]; then
  echo "F87 stale worker changed the active claim." >&2; exit 1
fi

# Only CURRENT fencing token can finalize local lab reconciliation. No CRM
# callback or delivery is involved: the marker is explicitly 'reconciled_lab'.
current="SET ROLE ${worker_a};
 UPDATE ${schema}.metadata_outbox SET state='reconciled_lab',lease_until=NULL
 WHERE organization_reference='${a_org}'
   AND submission_reference='${good_submission}'
   AND state='claimed' AND claim_version=2
   AND lease_until > transaction_timestamp()
 RETURNING claim_version;"
if [[ "$(psql_lab "$current")" != "2" ]]; then
  echo "F87 current fencing token could not finish lab reconciliation." >&2
  exit 1
fi
if [[ -n "$(psql_lab "$current")" ]]; then
  echo "F87 replay finalized an already-reconciled event." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT state||'|'||claim_version||'|'||attempts FROM ${schema}.metadata_outbox
 WHERE organization_reference='${a_org}'
   AND submission_reference='${good_submission}';")" != "reconciled_lab|2|2" ]]; then
  echo "F87 final lab state unexpected." >&2; exit 1
fi
if [[ "$(psql_lab "SELECT count(*) FROM information_schema.columns
 WHERE table_schema='${schema}' AND table_name='metadata_outbox';")" != "8" ]]; then
  echo "F87 outbox schema must remain eight metadata-only columns." >&2; exit 1
fi
echo "F87 PASS: concurrent lease claims, crash reclaim, stale-token fencing and tenant isolation (no CRM delivery)."
