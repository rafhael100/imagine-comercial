#!/usr/bin/env bash
# F91 disposable GitHub Actions PostgreSQL only; no transport or CRM ACK.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ||
      "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ||
      -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F91 refuses external or non-ephemeral PostgreSQL." >&2
  exit 2
fi
db=imagine_comercial_ci
schema=imagine_comercial_lead_ci
a_role=imagine_comercial_lead_ci_a
b_role=imagine_comercial_lead_ci_b
a_org=11111111-1111-4111-8111-111111111111
b_org=22222222-2222-4222-8222-222222222222
same_submission=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
another_submission=abababab-abab-4aba-8aba-abababababab
nonce=99999999-9999-4999-8999-999999999999
another_nonce=88888888-8888-4888-8888-888888888888
psql_lab(){ sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$db" -c "$1"; }
if [[ "$(psql_lab "SELECT count(*) FROM information_schema.tables
 WHERE table_schema='${schema}' AND table_name='metadata_ledger';")" != "1" ]]; then
  echo "F91 requires the disposable F85 metadata ledger." >&2
  exit 2
fi
if [[ "$(psql_lab "SELECT count(*) FROM information_schema.tables
 WHERE table_schema='${schema}' AND table_name='receipt_nonce_ledger';")" != "0" ]]; then
  echo "F91 refuses to reuse an existing nonce ledger." >&2
  exit 2
fi
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/sql/lead-receipt-nonce-ephemeral.sql

# The nonce is a receipt attempt marker; two connections racing on one tenant
# and nonce must produce one inserted row. Neither is an actual receipt.
insert="SET ROLE ${a_role};
 INSERT INTO ${schema}.receipt_nonce_ledger
 (organization_reference,nonce,submission_reference)
 VALUES ('${a_org}','${nonce}','${same_submission}')
 ON CONFLICT DO NOTHING RETURNING nonce;"
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
(psql_lab "$insert" > "$dir/one") & p1=$!
(psql_lab "$insert" > "$dir/two") & p2=$!
wait "$p1"
wait "$p2"
wins=$(cat "$dir/one" "$dir/two" | awk -v n="$nonce" '$0==n {i++} END {print i+0}')
if [[ "$wins" != "1" ]]; then
  echo "F91 expected one atomic nonce winner, got $wins." >&2; exit 1
fi
if [[ -n "$(psql_lab "$insert")" ]]; then
  echo "F91 replay of identical nonce inserted another receipt marker." >&2
  exit 1
fi

# A second submission using the SAME nonce cannot rewrite/claim the marker,
# because nonce uniqueness is per tenant, regardless of submission value.
if [[ -n "$(psql_lab "SET ROLE ${a_role};
 INSERT INTO ${schema}.receipt_nonce_ledger
 (organization_reference,nonce,submission_reference)
 VALUES ('${a_org}','${nonce}','${another_submission}')
 ON CONFLICT DO NOTHING RETURNING nonce;")" ]]; then
  echo "F91 conflicting submission reused a nonce within the tenant." >&2
  exit 1
fi
if [[ "$(psql_lab "SET ROLE ${a_role};
 SELECT submission_reference FROM ${schema}.receipt_nonce_ledger
 WHERE organization_reference='${a_org}' AND nonce='${nonce}';")" != "$same_submission" ]]; then
  echo "F91 reused nonce modified its original pinned submission." >&2
  exit 1
fi

# IMPORTANT negative claim: a different nonce for the SAME logical submission
# is permitted by the nonce ledger. It cannot authorize a second lead; that
# needs the separate (organization,submission) PK in metadata_ledger.
if [[ "$(psql_lab "SET ROLE ${a_role};
 INSERT INTO ${schema}.receipt_nonce_ledger
 (organization_reference,nonce,submission_reference)
 VALUES ('${a_org}','${another_nonce}','${same_submission}')
 RETURNING nonce;")" != "$another_nonce" ]]; then
  echo "F91 separate nonce should be accepted as another attempt, not another lead." >&2
  exit 1
fi
if [[ "$(psql_lab "SET ROLE ${a_role};
 SELECT count(*) FROM ${schema}.receipt_nonce_ledger
 WHERE submission_reference='${same_submission}';")" != "2" ||
      "$(psql_lab "SET ROLE ${a_role};
 SELECT count(*) FROM ${schema}.metadata_ledger
 WHERE submission_reference='${same_submission}';")" != "1" ]]; then
  echo "F91 conflated anti-replay nonce with business idempotency." >&2; exit 1
fi

# Tenant B may reuse the SAME nonce independently, on its own preexisting
# synthetic submission, but cannot observe A's rows or fake A's identity.
if [[ "$(psql_lab "SET ROLE ${b_role};
 SELECT count(*) FROM ${schema}.receipt_nonce_ledger;")" != "0" ]]; then
  echo "F91 nonce RLS leaked tenant A markers to tenant B." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${b_role};
 INSERT INTO ${schema}.receipt_nonce_ledger
 (organization_reference,nonce,submission_reference)
 VALUES ('${b_org}','${nonce}','${same_submission}')
 RETURNING nonce;")" != "$nonce" ]]; then
  echo "F91 independent tenant could not reserve its own nonce." >&2; exit 1
fi
if psql_lab "SET ROLE ${b_role};
 INSERT INTO ${schema}.receipt_nonce_ledger
 (organization_reference,nonce,submission_reference)
 VALUES ('${a_org}','77777777-7777-4777-8777-777777777777',
         '${same_submission}');" >/dev/null 2>&1; then
  echo "F91 tenant B forged a nonce for tenant A." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${b_role};
 SET app.lab_tenant_id='${a_org}';
 SELECT count(*) FROM ${schema}.receipt_nonce_ledger;")" != "1" ]]; then
  echo "F91 spoofing an app tenant GUC changed nonce visibility." >&2
  exit 1
fi

# Orphan receipt markers require an existing logical submission.
if psql_lab "SET ROLE ${a_role};
 INSERT INTO ${schema}.receipt_nonce_ledger
 (organization_reference,nonce,submission_reference)
 VALUES ('${a_org}','66666666-6666-4666-8666-666666666666',
         '55555555-5555-4555-8555-555555555555');" >/dev/null 2>&1; then
  echo "F91 receipt marker without a prior logical submission was accepted." >&2
  exit 1
fi
for statement in \
  "DELETE FROM ${schema}.receipt_nonce_ledger;" \
  "TRUNCATE ${schema}.receipt_nonce_ledger;" \
  "UPDATE ${schema}.receipt_nonce_ledger SET observed_at=now();"; do
  if psql_lab "SET ROLE ${a_role}; $statement" >/dev/null 2>&1; then
    echo "F91 ingestion role has destructive nonce rights." >&2; exit 1
  fi
done
if [[ "$(psql_lab "SELECT count(*) FROM information_schema.columns
 WHERE table_schema='${schema}' AND table_name='receipt_nonce_ledger';")" != "4" ]]; then
  echo "F91 nonce ledger must contain exactly four metadata-only columns." >&2
  exit 1
fi
echo "F91 PASS: concurrent nonce uniqueness, scope separation and tenant RLS in disposable PostgreSQL. No CRM receipt."
