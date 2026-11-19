#!/usr/bin/env bash
# F88: bounded recovery and review-only diagnosis, in disposable PG CI only.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ||
      "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ||
      -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F88 refuses execution outside disposable GitHub-hosted PostgreSQL CI." >&2
  exit 2
fi
db=imagine_comercial_ci
schema=imagine_comercial_lead_ci
a_org=11111111-1111-4111-8111-111111111111
submission=45454545-4545-4454-8454-454545454545
binding=cccccccc-cccc-4ccc-8ccc-cccccccccccc
site=dddddddd-dddd-4ddd-8ddd-dddddddddddd
form=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
destination=ffffffff-ffff-4fff-8fff-ffffffffffff
worker_a=imagine_comercial_lead_ci_worker_a
worker_b=imagine_comercial_lead_ci_worker_b
psql_lab(){ sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$db" -c "$1"; }

if [[ "$(psql_lab "SELECT 1 FROM information_schema.tables WHERE table_schema='${schema}'
 AND table_name='metadata_outbox';")" != "1" ]]; then
  echo "F88 requires the F86/F87 disposable outbox." >&2; exit 2
fi
if [[ "$(psql_lab "SELECT count(*) FROM information_schema.views
  WHERE table_schema='${schema}' AND table_name='exhausted_claim_review';")" != "0" ]]; then
  echo "F88 refuses to reuse an existing review view." >&2; exit 2
fi
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/sql/lead-outbox-exhaustion-review-ephemeral.sql

# A distinct synthetic logical submission, with no visitor, lead body or PII.
if psql_lab "SET ROLE ${worker_a}; SELECT count(*) FROM ${schema}.metadata_ledger;" >/dev/null 2>&1; then
  echo "F88 worker role should not be able to read ingestion ledger." >&2
  exit 1
fi
psql_lab "BEGIN;
 SET ROLE imagine_comercial_lead_ci_a;
 INSERT INTO ${schema}.metadata_ledger
 (organization_reference,submission_reference,binding_reference,
  site_reference,form_reference,destination_reference)
 VALUES ('${a_org}','${submission}','${binding}','${site}','${form}','${destination}');
 INSERT INTO ${schema}.metadata_outbox
 (organization_reference,submission_reference,event_kind)
 VALUES ('${a_org}','${submission}','pending_review');
 COMMIT;" >/dev/null

# Every attempt takes a new claim_version. Only a privileged fixture action
# simulates a crashed worker by advancing its lease to the past.
for expected in 0 1 2; do
  next=$((expected+1))
  result=$(psql_lab "SET ROLE ${worker_a};
  UPDATE ${schema}.metadata_outbox
  SET state='claimed',claim_version=claim_version+1,attempts=attempts+1,
      lease_until=transaction_timestamp()+interval '60 seconds'
  WHERE organization_reference='${a_org}'
    AND submission_reference='${submission}'
    AND claim_version=$expected AND attempts<3
    AND (state='queued' OR (state='claimed'
      AND lease_until < transaction_timestamp()))
  RETURNING claim_version;")
  if [[ "$result" != "$next" ]]; then
    echo "F88 expected bounded lease attempt $next, got '$result'." >&2; exit 1
  fi
  if [[ "$(psql_lab "SET ROLE ${worker_a};
    SELECT count(*) FROM ${schema}.exhausted_claim_review;")" != "0" ]]; then
    echo "F88 falsely marked an active lease as exhausted." >&2; exit 1
  fi
  # Simulation of a stopped consumer. Not a permission of the worker role.
  psql_lab "UPDATE ${schema}.metadata_outbox
    SET lease_until=transaction_timestamp()-interval '1 second'
    WHERE organization_reference='${a_org}' AND submission_reference='${submission}';" >/dev/null
done

# After three expired claims no automatic fourth attempt or silent ACK.
no_more="SET ROLE ${worker_a};
  UPDATE ${schema}.metadata_outbox
  SET claim_version=claim_version+1,attempts=attempts+1,
      lease_until=transaction_timestamp()+interval '60 seconds'
  WHERE organization_reference='${a_org}'
    AND submission_reference='${submission}'
    AND state='claimed' AND lease_until<transaction_timestamp()
    AND claim_version=3 AND attempts<3
  RETURNING claim_version;"
if [[ -n "$(psql_lab "$no_more")" ]]; then
  echo "F88 exhausted submission was auto-retried a fourth time." >&2; exit 1
fi
state=$(psql_lab "SET ROLE ${worker_a};
 SELECT state||'|'||claim_version||'|'||attempts FROM ${schema}.metadata_outbox
 WHERE organization_reference='${a_org}' AND submission_reference='${submission}';")
if [[ "$state" != "claimed|3|3" ]]; then
  echo "F88 did not preserve exhausted event for manual review." >&2; exit 1
fi
# The view uses SECURITY INVOKER; it must show only this worker's tenant.
a_result=$(psql_lab "SET ROLE ${worker_a};
 SELECT claim_version||'|'||attempts FROM ${schema}.exhausted_claim_review;")
b_count=$(psql_lab "SET ROLE ${worker_b};
 SELECT count(*) FROM ${schema}.exhausted_claim_review;")
if [[ "$a_result" != "3|3" || "$b_count" != "0" ]]; then
  echo "F88 exhausted-event review leaked tenant data or missed the alert." >&2
  exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_b}; SET app.lab_tenant_id='${a_org}';
 SELECT count(*) FROM ${schema}.exhausted_claim_review;")" != "0" ]]; then
  echo "F88 review allowed GUC-based tenant spoofing." >&2; exit 1
fi
# No direct edits via view, no fabricated success while lease has expired.
if psql_lab "SET ROLE ${worker_a};
 UPDATE ${schema}.exhausted_claim_review SET attempts=0;" >/dev/null 2>&1; then
  echo "F88 worker could rewrite review state through the view." >&2; exit 1
fi
if [[ -n "$(psql_lab "SET ROLE ${worker_a};
 UPDATE ${schema}.metadata_outbox SET state='reconciled_lab',lease_until=NULL
 WHERE organization_reference='${a_org}' AND submission_reference='${submission}'
   AND state='claimed' AND claim_version=3 AND lease_until>transaction_timestamp()
 RETURNING claim_version;")" ]]; then
  echo "F88 expired lease forged successful reconciliation." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT count(*) FROM ${schema}.exhausted_claim_review;")" != "1" ]]; then
  echo "F88 review-only queue lost the failed submission." >&2; exit 1
fi
echo "F88 PASS: three failed leases stop retries and remain visible only for same-tenant review; no CRM delivery."
