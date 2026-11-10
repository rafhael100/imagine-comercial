-- F92: PostgreSQL disposable CI only. An ambiguous transport outcome is NOT
-- a trusted CRM receipt. Persist a hold before an otherwise-eligible retry.
-- Depends on F85–F91 fixtures, including the F89 execute-only claim function.
BEGIN;
CREATE TABLE imagine_comercial_lead_ci.unknown_outcome_hold (
  organization_reference uuid NOT NULL,
  submission_reference uuid NOT NULL,
  observed_claim_version bigint NOT NULL CHECK (observed_claim_version > 0),
  observed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_reference,submission_reference),
  FOREIGN KEY (organization_reference,submission_reference)
    REFERENCES imagine_comercial_lead_ci.metadata_ledger
    (organization_reference,submission_reference)
);
REVOKE ALL ON imagine_comercial_lead_ci.unknown_outcome_hold FROM PUBLIC;
ALTER TABLE imagine_comercial_lead_ci.unknown_outcome_hold ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagine_comercial_lead_ci.unknown_outcome_hold FORCE ROW LEVEL SECURITY;
GRANT SELECT ON imagine_comercial_lead_ci.unknown_outcome_hold
  TO imagine_comercial_lead_ci_worker_a,imagine_comercial_lead_ci_worker_b;

CREATE POLICY unknown_hold_worker_a ON imagine_comercial_lead_ci.unknown_outcome_hold
  FOR SELECT TO imagine_comercial_lead_ci_worker_a
  USING (organization_reference='11111111-1111-4111-8111-111111111111'::uuid);
CREATE POLICY unknown_hold_worker_b ON imagine_comercial_lead_ci.unknown_outcome_hold
  FOR SELECT TO imagine_comercial_lead_ci_worker_b
  USING (organization_reference='22222222-2222-4222-8222-222222222222'::uuid);

-- The consumer can report an *unknown* status only for its current, active
-- fencing version; never claim delivered, delete data, or reset attempts.
-- Owner is privileged solely within disposable CI; not a production pattern.
CREATE FUNCTION imagine_comercial_lead_ci.note_unknown_lab_a(
  p_submission uuid,p_claim_version bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog
AS $$
DECLARE inserted uuid;
BEGIN
  IF p_submission IS NULL OR p_claim_version IS NULL
     OR p_claim_version <= 0 THEN
    RETURN false;
  END IF;
  INSERT INTO imagine_comercial_lead_ci.unknown_outcome_hold
    (organization_reference,submission_reference,observed_claim_version)
  SELECT organization_reference,submission_reference,claim_version
  FROM imagine_comercial_lead_ci.metadata_outbox
  WHERE organization_reference='11111111-1111-4111-8111-111111111111'::uuid
    AND submission_reference=p_submission
    AND event_kind='pending_review'
    AND state='claimed'
    AND claim_version=p_claim_version
    AND lease_until > transaction_timestamp()
  ON CONFLICT DO NOTHING
  RETURNING submission_reference INTO inserted;
  RETURN inserted IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION imagine_comercial_lead_ci.note_unknown_lab_a(uuid,bigint)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION imagine_comercial_lead_ci.note_unknown_lab_a(uuid,bigint)
  TO imagine_comercial_lead_ci_worker_a;

-- Replace only the existing CI test function. Its existing EXECUTE grant to A
-- is retained, while all retries now consult the persistent unknown-outcome
-- hold before an expired lease can be reclaimed.
CREATE OR REPLACE FUNCTION imagine_comercial_lead_ci.claim_lab_a(
  p_submission uuid,p_expected_version bigint
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog
AS $$
DECLARE next_version bigint;
BEGIN
  IF p_submission IS NULL OR p_expected_version IS NULL
     OR p_expected_version < 0 THEN
    RETURN NULL;
  END IF;
  UPDATE imagine_comercial_lead_ci.metadata_outbox AS o
  SET state='claimed',
      claim_version=o.claim_version+1,
      attempts=o.attempts+1,
      lease_until=transaction_timestamp()+interval '60 seconds'
  WHERE o.organization_reference='11111111-1111-4111-8111-111111111111'::uuid
    AND o.submission_reference=p_submission
    AND o.event_kind='pending_review'
    AND o.claim_version=p_expected_version
    AND o.attempts<3
    AND (o.state='queued'
      OR (o.state='claimed' AND o.lease_until<transaction_timestamp()))
    AND NOT EXISTS (
      SELECT 1 FROM imagine_comercial_lead_ci.unknown_outcome_hold AS h
      WHERE h.organization_reference=o.organization_reference
        AND h.submission_reference=o.submission_reference
    )
  RETURNING o.claim_version INTO next_version;
  RETURN next_version;
END;
$$;
COMMIT;
