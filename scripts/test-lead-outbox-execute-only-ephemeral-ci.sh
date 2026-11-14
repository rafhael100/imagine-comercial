#!/usr/bin/env bash
# F89: SQL SECURITY DEFINER claim is a disposable CI proof, NOT Portal auth.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ||
      "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ||
      -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F89 refuses non-ephemeral PostgreSQL or external hosts." >&2
  exit 2
fi
db=imagine_comercial_ci
schema=imagine_comercial_lead_ci
a_role=imagine_comercial_lead_ci_a
b_role=imagine_comercial_lead_ci_b
worker_a=imagine_comercial_lead_ci_worker_a
worker_b=imagine_comercial_lead_ci_worker_b
a_org=11111111-1111-4111-8111-111111111111
b_org=22222222-2222-4222-8222-222222222222
a_submission=67676767-6767-4676-8676-676767676767
b_submission=78787878-7878-4787-8787-787878787878
binding=cccccccc-cccc-4ccc-8ccc-cccccccccccc
site=dddddddd-dddd-4ddd-8ddd-dddddddddddd
form=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
destination=ffffffff-ffff-4fff-8fff-ffffffffffff
psql_lab(){ sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$db" -c "$1"; }

if [[ "$(psql_lab "SELECT 1 FROM information_schema.tables
 WHERE table_schema='${schema}' AND table_name='metadata_outbox';")" != "1" ]]; then
  echo "F89 requires disposable F86/F87/F88 outbox." >&2; exit 2
fi
if [[ "$(psql_lab "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='${schema}' AND p.proname='claim_lab_a';")" != "0" ]]; then
  echo "F89 refuses existing claim function." >&2; exit 2
fi
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/sql/lead-outbox-execute-only-claim-ephemeral.sql

# Fixture-only ingestion user creates synthetic rows for separate tenants.
for record in "${a_role}|${a_org}|${a_submission}" "${b_role}|${b_org}|${b_submission}"; do
  IFS='|' read -r role org submission <<< "$record"
  psql_lab "BEGIN; SET ROLE $role;
   INSERT INTO ${schema}.metadata_ledger
   (organization_reference,submission_reference,binding_reference,
    site_reference,form_reference,destination_reference)
   VALUES ('$org','$submission','${binding}','${site}','${form}','${destination}');
   INSERT INTO ${schema}.metadata_outbox
   (organization_reference,submission_reference,event_kind)
   VALUES ('$org','$submission','pending_review');
   COMMIT;" >/dev/null
done

# SQL privileges are essential: even the owner of a valid consumer role
# cannot edit attempts, version, lease, status, event kind or original IDs.
for statement in \
  "UPDATE ${schema}.metadata_outbox SET attempts=0 WHERE organization_reference='${a_org}';" \
  "UPDATE ${schema}.metadata_outbox SET state='reconciled_lab',lease_until=NULL WHERE organization_reference='${a_org}';" \
  "DELETE FROM ${schema}.metadata_outbox;" \
  "INSERT INTO ${schema}.metadata_outbox
  (organization_reference,submission_reference,event_kind)
  VALUES ('${a_org}','${a_submission}','pending_review');"; do
  if psql_lab "SET ROLE ${worker_a}; $statement" >/dev/null 2>&1; then
    echo "F89 worker bypassed execute-only grant: $statement" >&2; exit 1
  fi
done

# Even a syntactically valid UUID of another tenant can never be claimed.
foreign="SET ROLE ${worker_a};
  SELECT ${schema}.claim_lab_a('${b_submission}'::uuid,0);"
if [[ -n "$(psql_lab "$foreign")" ]]; then
  echo "F89 fixed-tenant function claimed another organization's submission." >&2
  exit 1
fi
if psql_lab "SET ROLE ${worker_b};
  SELECT ${schema}.claim_lab_a('${b_submission}'::uuid,0);" >/dev/null 2>&1; then
  echo "F89 unauthorized tenant worker executed A-only function." >&2
  exit 1
fi

# Two competing PostgreSQL connections call the same guarded function.
claim0="SET ROLE ${worker_a};
  SELECT ${schema}.claim_lab_a('${a_submission}'::uuid,0);"
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
(psql_lab "$claim0" > "$dir/one") & p1=$!
(psql_lab "$claim0" > "$dir/two") & p2=$!
wait "$p1"
wait "$p2"
wins=$(cat "$dir/one" "$dir/two" | awk '$0=="1" {n++} END {print n+0}')
if [[ "$wins" != "1" ]]; then
  echo "F89 execute-only concurrent claim had $wins winners." >&2; exit 1
fi
if [[ -n "$(psql_lab "$claim0")" ]]; then
  echo "F89 stale retry won a guarded claim." >&2; exit 1
fi

for expected in 1 2; do
  next=$((expected+1))
  # Simulate a crashed worker only as privileged TEST FIXTURE owner.
  psql_lab "UPDATE ${schema}.metadata_outbox
   SET lease_until=transaction_timestamp()-interval '1 second'
   WHERE organization_reference='${a_org}'
     AND submission_reference='${a_submission}';" >/dev/null
  result=$(psql_lab "SET ROLE ${worker_a};
    SELECT ${schema}.claim_lab_a('${a_submission}'::uuid,$expected);")
  if [[ "$result" != "$next" ]]; then
    echo "F89 expected fencing version $next after expiration, got '$result'." >&2
    exit 1
  fi
done
# Exhaust the third claim: in this test the privileged operator advances
# time, but an unprivileged worker may not reset the counter.
psql_lab "UPDATE ${schema}.metadata_outbox
 SET lease_until=transaction_timestamp()-interval '1 second'
 WHERE organization_reference='${a_org}'
   AND submission_reference='${a_submission}';" >/dev/null
if [[ -n "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.claim_lab_a('${a_submission}'::uuid,3);")" ]]; then
  echo "F89 execute-only function exceeded retry limit." >&2; exit 1
fi
if psql_lab "SET ROLE ${worker_a}; UPDATE ${schema}.metadata_outbox
 SET attempts=0 WHERE organization_reference='${a_org}';" >/dev/null 2>&1; then
  echo "F89 worker reset exhausted attempt counter." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT state||'|'||claim_version||'|'||attempts FROM ${schema}.metadata_outbox
 WHERE organization_reference='${a_org}'
 AND submission_reference='${a_submission}';")" != "claimed|3|3" ]]; then
  echo "F89 exhausted event was not preserved in its original tenant." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_b};
 SELECT count(*) FROM ${schema}.metadata_outbox
 WHERE submission_reference='${a_submission}';")" != "0" ]]; then
  echo "F89 worker B could view tenant A metadata." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT count(*) FROM ${schema}.exhausted_claim_review
 WHERE submission_reference='${a_submission}';")" != "1" ]]; then
  echo "F89 exhausted protected event is missing from same-tenant triage." >&2
  exit 1
fi
echo "F89 PASS: EXECUTE-only fixed-tenant PostgreSQL claim; no direct worker UPDATE, no replay, bounded retries, no delivery."
