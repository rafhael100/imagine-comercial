-- F85: PostgreSQL 16+ fixture for disposable GitHub-hosted CI only.
-- No real leads, PII, endpoints, migrations, public runtime or VPS data.
-- Never apply this fixture to staging/production or a pre-existing database.
CREATE SCHEMA imagine_comercial_lead_ci;
REVOKE ALL ON SCHEMA imagine_comercial_lead_ci FROM PUBLIC;

CREATE ROLE imagine_comercial_lead_ci_a NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE imagine_comercial_lead_ci_b NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

CREATE TABLE imagine_comercial_lead_ci.metadata_ledger (
  organization_reference uuid NOT NULL,
  submission_reference uuid NOT NULL,
  binding_reference uuid NOT NULL,
  site_reference uuid NOT NULL,
  form_reference uuid NOT NULL,
  destination_reference uuid NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK(state IN
    ('open','reserved','outcome_unknown','delivered_claimed','expired_claimed')),
  version bigint NOT NULL DEFAULT 0 CHECK(version >= 0),
  PRIMARY KEY (organization_reference,submission_reference)
);

REVOKE ALL ON imagine_comercial_lead_ci.metadata_ledger FROM PUBLIC;
ALTER TABLE imagine_comercial_lead_ci.metadata_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagine_comercial_lead_ci.metadata_ledger FORCE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA imagine_comercial_lead_ci
  TO imagine_comercial_lead_ci_a,imagine_comercial_lead_ci_b;
GRANT SELECT,INSERT ON imagine_comercial_lead_ci.metadata_ledger
  TO imagine_comercial_lead_ci_a,imagine_comercial_lead_ci_b;
-- The lab role cannot rewrite the pinned tenant, site/form, or CRM destination.
GRANT UPDATE(state,version) ON imagine_comercial_lead_ci.metadata_ledger
  TO imagine_comercial_lead_ci_a,imagine_comercial_lead_ci_b;

-- Identity is the DB role selected by the trusted CI harness. A caller-supplied
-- session GUC or JSON tenant ID does NOT grant row visibility.
CREATE POLICY lab_a_fixed_organization ON imagine_comercial_lead_ci.metadata_ledger
  FOR ALL TO imagine_comercial_lead_ci_a
  USING (organization_reference = '11111111-1111-4111-8111-111111111111'::uuid)
  WITH CHECK (organization_reference = '11111111-1111-4111-8111-111111111111'::uuid);

CREATE POLICY lab_b_fixed_organization ON imagine_comercial_lead_ci.metadata_ledger
  FOR ALL TO imagine_comercial_lead_ci_b
  USING (organization_reference = '22222222-2222-4222-8222-222222222222'::uuid)
  WITH CHECK (organization_reference = '22222222-2222-4222-8222-222222222222'::uuid);

COMMENT ON TABLE imagine_comercial_lead_ci.metadata_ledger IS
  'F85 disposable CI-only, synthetic UUID metadata. Never deploy.';
