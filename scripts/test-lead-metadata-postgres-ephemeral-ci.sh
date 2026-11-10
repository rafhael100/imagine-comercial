#!/usr/bin/env bash
# F85: executes ONLY within the disposable database created by F51 on hosted CI.
# No client content, persistent service, VPS, API or actual CRM delivery.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ||
      "${IMAGINE_EPHEMERAL_PG_TEST:-}" != "1" ]]; then
  echo "F85 refuses execution outside isolated GitHub-hosted PostgreSQL CI." >&2
  exit 2
fi
if [[ -n "${PGHOST:-}" || -n "${PGHOSTADDR:-}" || -n "${PGSERVICE:-}" ]]; then
  echo "F85 refuses external PostgreSQL connection configuration." >&2
  exit 2
fi
db=imagine_comercial_ci
schema=imagine_comercial_lead_ci
a_role=imagine_comercial_lead_ci_a
b_role=imagine_comercial_lead_ci_b
a_org=11111111-1111-4111-8111-111111111111
b_org=22222222-2222-4222-8222-222222222222
submission=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
binding=cccccccc-cccc-4ccc-8ccc-cccccccccccc
site=dddddddd-dddd-4ddd-8ddd-dddddddddddd
form=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
destination=ffffffff-ffff-4fff-8fff-ffffffffffff
new_destination=99999999-9999-4999-8999-999999999999

psql_lab(){
  sudo -u postgres psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$db" -c "$1"
}
if [[ "$(psql_lab "SELECT 1 FROM pg_namespace WHERE nspname='${schema}'")" == "1" ]]; then
  echo "F85 refuses to reuse a pre-existing lead lab schema." >&2
  exit 2
fi
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/sql/lead-idempotency-ephemeral.sql

# Test the two independent tenant roles. No PII and no HTTP transport.
psql_lab "SET ROLE ${a_role};
  INSERT INTO ${schema}.metadata_ledger
  (organization_reference,submission_reference,binding_reference,
   site_reference,form_reference,destination_reference)
  VALUES ('${a_org}','${submission}','${binding}',
          '${site}','${form}','${destination}');" >/dev/null
if [[ "$(psql_lab "SET ROLE ${a_role}; SELECT count(*) FROM ${schema}.metadata_ledger;")" != "1" ]]; then
  echo "F85 expected tenant A's own fixture." >&2; exit 1
fi
if [[ "$(psql_lab "SET ROLE ${b_role}; SELECT count(*) FROM ${schema}.metadata_ledger;")" != "0" ]]; then
  echo "F85 cross-tenant read was not isolated by RLS." >&2; exit 1
fi

# Spoofing a caller-supplied organization setting must never create authority.
if [[ "$(psql_lab "SET ROLE ${b_role};
  SET app.lab_tenant_id='${a_org}';
  SELECT count(*) FROM ${schema}.metadata_ledger;")" != "0" ]]; then
  echo "F85 tenant context could be spoofed through session metadata." >&2; exit 1
fi

# Tenants can have the same submission reference, but never see each other's
# row. The physical uniqueness scope is (organization, submission).
psql_lab "SET ROLE ${b_role};
  INSERT INTO ${schema}.metadata_ledger
  (organization_reference,submission_reference,binding_reference,
   site_reference,form_reference,destination_reference)
  VALUES ('${b_org}','${submission}','${binding}',
          '${site}','${form}','${destination}');" >/dev/null
if [[ "$(psql_lab "SET ROLE ${a_role}; SELECT count(*) FROM ${schema}.metadata_ledger;")" != "1" ||
      "$(psql_lab "SET ROLE ${b_role}; SELECT count(*) FROM ${schema}.metadata_ledger;")" != "1" ]]; then
  echo "F85 tenant rows collided or leaked." >&2; exit 1
fi

# Wrong organization is rejected even if the client claims another ID.
if psql_lab "SET ROLE ${b_role};
  INSERT INTO ${schema}.metadata_ledger
  (organization_reference,submission_reference,binding_reference,
   site_reference,form_reference,destination_reference)
  VALUES ('${a_org}','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          '${binding}','${site}','${form}','${destination}');" >/dev/null 2>&1; then
  echo "F85 forged-tenant INSERT succeeded." >&2; exit 1
fi

# Reusing a logical submission with a new destination cannot silently create
# a second row: its unique key is (organization, submission).
if psql_lab "SET ROLE ${a_role};
  INSERT INTO ${schema}.metadata_ledger
  (organization_reference,submission_reference,binding_reference,
   site_reference,form_reference,destination_reference)
  VALUES ('${a_org}','${submission}','${binding}',
          '${site}','${form}','${new_destination}');" >/dev/null 2>&1; then
  echo "F85 conflicting destination bypassed the unique key." >&2; exit 1
fi

# The application role can change only state/version, never the original
# organization, binding, site, form or destination.
for column in organization_reference binding_reference site_reference form_reference destination_reference; do
  if psql_lab "SET ROLE ${a_role};
      UPDATE ${schema}.metadata_ledger SET ${column}='${new_destination}'
      WHERE organization_reference='${a_org}';" >/dev/null 2>&1; then
    echo "F85 application role was allowed to overwrite pinned ${column}." >&2
    exit 1
  fi
done
for statement in \
  "DELETE FROM ${schema}.metadata_ledger;" \
  "TRUNCATE ${schema}.metadata_ledger;"; do
  if psql_lab "SET ROLE ${a_role}; ${statement}" >/dev/null 2>&1; then
    echo "F85 application role has destructive rights." >&2; exit 1
  fi
done

# Two distinct PostgreSQL clients race on one open entry using UPDATE ... CAS.
# Only one must win (READ COMMITTED rechecks the predicate after row lock).
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
cas="SET ROLE ${a_role};
 UPDATE ${schema}.metadata_ledger
 SET state='reserved', version=version+1
 WHERE organization_reference='${a_org}' AND submission_reference='${submission}'
   AND state='open' AND version=0
 RETURNING version;"
(psql_lab "$cas" > "$dir/cas1") & p1=$!
(psql_lab "$cas" > "$dir/cas2") & p2=$!
wait "$p1"
wait "$p2"
wins=$(cat "$dir/cas1" "$dir/cas2" | awk '$0=="1" {n++} END {print n+0}')
if [[ "$wins" != "1" ]]; then
  echo "F85 expected exactly one PostgreSQL CAS winner, got ${wins}." >&2
  exit 1
fi
if [[ "$(psql_lab "SET ROLE ${a_role};
  SELECT state||'|'||version FROM ${schema}.metadata_ledger
  WHERE organization_reference='${a_org}';")" != "reserved|1" ]]; then
  echo "F85 committed metadata state differs from CAS winner." >&2; exit 1
fi
if [[ -n "$(psql_lab "$cas")" ]]; then
  echo "F85 stale CAS replay changed the reservation." >&2; exit 1
fi

# Metadata-only: the fixture stores neither visitor PII nor lead body.
column_count=$(psql_lab "SELECT count(*) FROM information_schema.columns
  WHERE table_schema='${schema}' AND table_name='metadata_ledger';")
if [[ "$column_count" != "8" ]]; then
  echo "F85 expected exactly eight metadata-only columns." >&2; exit 1
fi
echo "F85 PASS: disposable PostgreSQL real RLS, tenant isolation, immutable context, unique key and concurrent CAS. No lead delivery."
