-- F86: temporary PostgreSQL transactional outbox fixture.
-- Depends on the disposable F85 schema and two NOLOGIN roles in GitHub CI.
-- Enqueued metadata is NOT an acknowledgment or actual CRM delivery.
CREATE TABLE imagine_comercial_lead_ci.metadata_outbox (
  organization_reference uuid NOT NULL,
  submission_reference uuid NOT NULL,
  event_kind text NOT NULL CHECK (event_kind = 'pending_review'),
  enqueued_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_reference,submission_reference,event_kind),
  FOREIGN KEY (organization_reference,submission_reference)
    REFERENCES imagine_comercial_lead_ci.metadata_ledger
      (organization_reference,submission_reference)
);
REVOKE ALL ON imagine_comercial_lead_ci.metadata_outbox FROM PUBLIC;
ALTER TABLE imagine_comercial_lead_ci.metadata_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagine_comercial_lead_ci.metadata_outbox FORCE ROW LEVEL SECURITY;

GRANT SELECT,INSERT ON imagine_comercial_lead_ci.metadata_outbox
  TO imagine_comercial_lead_ci_a,imagine_comercial_lead_ci_b;

CREATE POLICY outbox_lab_a ON imagine_comercial_lead_ci.metadata_outbox
  FOR ALL TO imagine_comercial_lead_ci_a
  USING (organization_reference = '11111111-1111-4111-8111-111111111111'::uuid)
  WITH CHECK (organization_reference = '11111111-1111-4111-8111-111111111111'::uuid);

CREATE POLICY outbox_lab_b ON imagine_comercial_lead_ci.metadata_outbox
  FOR ALL TO imagine_comercial_lead_ci_b
  USING (organization_reference = '22222222-2222-4222-8222-222222222222'::uuid)
  WITH CHECK (organization_reference = '22222222-2222-4222-8222-222222222222'::uuid);

COMMENT ON TABLE imagine_comercial_lead_ci.metadata_outbox IS
  'F86 CI-only pending metadata review event, not a message delivery proof.';
