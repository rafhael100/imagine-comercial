-- F91: disposable Postgres-only receipt nonce marker, not an operational ACK.
-- CRM F3-16 explicitly distinguishes nonce replay from logical submission.
-- No payload, signature, key, contact, IP, API, real customer or migration.
CREATE TABLE imagine_comercial_lead_ci.receipt_nonce_ledger (
  organization_reference uuid NOT NULL,
  nonce uuid NOT NULL,
  submission_reference uuid NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_reference,nonce),
  FOREIGN KEY (organization_reference,submission_reference)
    REFERENCES imagine_comercial_lead_ci.metadata_ledger
      (organization_reference,submission_reference)
);
REVOKE ALL ON imagine_comercial_lead_ci.receipt_nonce_ledger FROM PUBLIC;
ALTER TABLE imagine_comercial_lead_ci.receipt_nonce_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagine_comercial_lead_ci.receipt_nonce_ledger FORCE ROW LEVEL SECURITY;

GRANT SELECT,INSERT ON imagine_comercial_lead_ci.receipt_nonce_ledger
 TO imagine_comercial_lead_ci_a,imagine_comercial_lead_ci_b;

CREATE POLICY nonce_a_fixed_org ON imagine_comercial_lead_ci.receipt_nonce_ledger
 FOR ALL TO imagine_comercial_lead_ci_a
 USING (organization_reference='11111111-1111-4111-8111-111111111111'::uuid)
 WITH CHECK (organization_reference='11111111-1111-4111-8111-111111111111'::uuid);

CREATE POLICY nonce_b_fixed_org ON imagine_comercial_lead_ci.receipt_nonce_ledger
 FOR ALL TO imagine_comercial_lead_ci_b
 USING (organization_reference='22222222-2222-4222-8222-222222222222'::uuid)
 WITH CHECK (organization_reference='22222222-2222-4222-8222-222222222222'::uuid);

COMMENT ON TABLE imagine_comercial_lead_ci.receipt_nonce_ledger IS
 'F91 disposable CI receipt nonce uniqueness only; not a CRM write receipt.';
