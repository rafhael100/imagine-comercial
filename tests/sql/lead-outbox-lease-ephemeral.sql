-- F87: disposable GitHub CI ONLY; extends F86 metadata-only outbox.
-- No real lead, worker, endpoint, delivery receipt, production migration or data.
CREATE ROLE imagine_comercial_lead_ci_worker_a NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE imagine_comercial_lead_ci_worker_b NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

ALTER TABLE imagine_comercial_lead_ci.metadata_outbox
  ADD COLUMN state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','claimed','reconciled_lab')),
  ADD COLUMN claim_version bigint NOT NULL DEFAULT 0
    CHECK (claim_version >= 0),
  ADD COLUMN attempts smallint NOT NULL DEFAULT 0
    CHECK (attempts >= 0 AND attempts <= 3),
  ADD COLUMN lease_until timestamptz,
  ADD CONSTRAINT f87_lease_state_consistency
    CHECK ((state='claimed' AND lease_until IS NOT NULL)
       OR (state IN ('queued','reconciled_lab') AND lease_until IS NULL));

GRANT USAGE ON SCHEMA imagine_comercial_lead_ci TO
  imagine_comercial_lead_ci_worker_a,imagine_comercial_lead_ci_worker_b;
GRANT SELECT ON imagine_comercial_lead_ci.metadata_outbox TO
  imagine_comercial_lead_ci_worker_a,imagine_comercial_lead_ci_worker_b;
-- Column-scoped update permission. A worker may not reassign ownership or
-- mutate the event identity, kind or creation time.
GRANT UPDATE (state,claim_version,attempts,lease_until)
  ON imagine_comercial_lead_ci.metadata_outbox TO
  imagine_comercial_lead_ci_worker_a,imagine_comercial_lead_ci_worker_b;

CREATE POLICY outbox_worker_a ON imagine_comercial_lead_ci.metadata_outbox
  FOR ALL TO imagine_comercial_lead_ci_worker_a
  USING (organization_reference='11111111-1111-4111-8111-111111111111'::uuid)
  WITH CHECK (organization_reference='11111111-1111-4111-8111-111111111111'::uuid);

CREATE POLICY outbox_worker_b ON imagine_comercial_lead_ci.metadata_outbox
  FOR ALL TO imagine_comercial_lead_ci_worker_b
  USING (organization_reference='22222222-2222-4222-8222-222222222222'::uuid)
  WITH CHECK (organization_reference='22222222-2222-4222-8222-222222222222'::uuid);

COMMENT ON COLUMN imagine_comercial_lead_ci.metadata_outbox.state IS
  'F87 CI-only state; reconciled_lab is NOT a CRM delivery acknowledgment.';
