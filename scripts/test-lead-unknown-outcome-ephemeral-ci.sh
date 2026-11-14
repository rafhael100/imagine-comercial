#!/usr/bin/env bash
# F92: only inside F51 newly created disposable CI PostgreSQL.
# A reported unknown transport outcome blocks retry; it never proves delivery.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ||
      "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ||
      -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F92 refuses external or non-ephemeral PostgreSQL." >&2
  exit 2
fi
db=imagine_comercial_ci
schema=imagine_comercial_lead_ci
a_org=11111111-1111-4111-8111-111111111111
b_org=22222222-2222-4222-8222-222222222222
submission=51515151-5151-4515-8515-515151515151
other_submission=62626262-6262-4626-8626-626262626262
binding=cccccccc-cccc-4ccc-8ccc-cccccccccccc
site=dddddddd-dddd-4ddd-8ddd-dddddddddddd
form=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
destination=ffffffff-ffff-4fff-8fff-ffffffffffff
role_a=imagine_comercial_lead_ci_a
worker_a=imagine_comercial_lead_ci_worker_a
worker_b=imagine_comercial_lead_ci_worker_b
psql_lab(){ sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$db" -c "$1"; }

if [[ "$(psql_lab "SELECT count(*) FROM information_schema.tables
 WHERE table_schema='${schema}' AND table_name='receipt_nonce_ledger'")" != "1" ]]; then
  echo "F92 requires existing disposable F91 fixture." >&2; exit 2
fi
if [[ "$(psql_lab "SELECT count(*) FROM information_schema.tables
 WHERE table_schema='${schema}' AND table_name='unknown_outcome_hold'")" != "0" ]]; then
  echo "F92 refuses to reuse existing outcome hold." >&2; exit 2
fi
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/sql/lead-unknown-outcome-hold-ephemeral.sql

# Create two metadata-only synthetic submissions in a single ingestion tx.
for item in "$submission" "$other_submission"; do
  psql_lab "BEGIN; SET ROLE ${role_a};
    INSERT INTO ${schema}.metadata_ledger
      (organization_reference,submission_reference,binding_reference,
       site_reference,form_reference,destination_reference)
    VALUES ('${a_org}','$item','${binding}','${site}','${form}','${destination}');
    INSERT INTO ${schema}.metadata_outbox
      (organization_reference,submission_reference,event_kind)
    VALUES ('${a_org}','$item','pending_review');
    COMMIT;" >/dev/null
done

# Cannot mark unknown before a claim or using an arbitrary version.
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.note_unknown_lab_a('${submission}'::uuid,1);")" != "f" ]]; then
  echo "F92 allowed false unknown observation before a claim." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.claim_lab_a('${submission}'::uuid,0);")" != "1" ]]; then
  echo "F92 initial synthetic claim failed." >&2; exit 1
fi
for version in 0 2 -1; do
  if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.note_unknown_lab_a('${submission}'::uuid,$version);")" != "f" ]]; then
    echo "F92 wrong fencing version created unknown outcome." >&2; exit 1
  fi
done
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.note_unknown_lab_a('${submission}'::uuid,1);")" != "t" ]]; then
  echo "F92 could not record unknown outcome for active fenced claim." >&2
  exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.note_unknown_lab_a('${submission}'::uuid,1);")" != "f" ]]; then
  echo "F92 duplicate unknown claim was not idempotent." >&2; exit 1
fi

# A malicious worker cannot edit, clear or forge the hold outside the function.
for statement in \
  "DELETE FROM ${schema}.unknown_outcome_hold;" \
  "UPDATE ${schema}.unknown_outcome_hold SET observed_claim_version=999;" \
  "INSERT INTO ${schema}.unknown_outcome_hold
   (organization_reference,submission_reference,observed_claim_version)
   VALUES ('${a_org}','${other_submission}',999);"; do
  if psql_lab "SET ROLE ${worker_a}; $statement" >/dev/null 2>&1; then
    echo "F92 consumer bypassed review-only hold privileges." >&2; exit 1
  fi
done
if psql_lab "SET ROLE ${worker_b};
 SELECT ${schema}.note_unknown_lab_a('${submission}'::uuid,1);" >/dev/null 2>&1; then
  echo "F92 consumer B executed A-only unknown reporter." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_b};
 SELECT count(*) FROM ${schema}.unknown_outcome_hold;")" != "0" ||
      "$(psql_lab "SET ROLE ${worker_a};
 SELECT count(*) FROM ${schema}.unknown_outcome_hold;")" != "1" ]]; then
  echo "F92 unknown outcome RLS exposed another tenant." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_b}; SET app.lab_tenant_id='${a_org}';
 SELECT count(*) FROM ${schema}.unknown_outcome_hold;")" != "0" ]]; then
  echo "F92 forged tenant GUC bypassed unknown-outcome RLS." >&2; exit 1
fi

# Simulated timeout after recording uncertainty: privileged CI fixture owner
# advances lease into past. The next attempt MUST still be barred.
psql_lab "UPDATE ${schema}.metadata_outbox
 SET lease_until=transaction_timestamp()-interval '1 second'
 WHERE organization_reference='${a_org}' AND submission_reference='${submission}';" >/dev/null
if [[ -n "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.claim_lab_a('${submission}'::uuid,1);")" ]]; then
  echo "F92 unknown outcome led to unsafe automatic retry." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT state||'|'||claim_version||'|'||attempts
 FROM ${schema}.metadata_outbox WHERE organization_reference='${a_org}'
 AND submission_reference='${submission}';")" != "claimed|1|1" ]]; then
  echo "F92 uncertain delivery changed its durable state." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT count(*) FROM ${schema}.unknown_outcome_hold
 WHERE submission_reference='${submission}';")" != "1" ]]; then
  echo "F92 lost the unknown-outcome review marker." >&2; exit 1
fi

# The separate submission is not globally blocked: no hold, no cross-scope
# pollution, and cannot be mistaken for confirmation of the first submission.
if [[ "$(psql_lab "SET ROLE ${worker_a};
 SELECT ${schema}.claim_lab_a('${other_submission}'::uuid,0);")" != "1" ]]; then
  echo "F92 hold blocked an unrelated logical submission." >&2; exit 1
fi

# A claimed HTTP success, a signature-consistent HMAC, or a nonce marker is
# not independently proven CRM storage. This test has no delivery state.
if [[ "$(psql_lab "SELECT count(*) FROM information_schema.columns
 WHERE table_schema='${schema}' AND table_name='unknown_outcome_hold';")" != "4" ]]; then
  echo "F92 hold must contain exactly four metadata columns." >&2; exit 1
fi
echo "F92 PASS: unknown transport outcome is durable, tenant-scoped and blocks expired-lease retries; no CRM delivery."
