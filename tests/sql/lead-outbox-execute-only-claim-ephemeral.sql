-- F89: EXECUTE-only outbox lease claim in ephemeral GitHub CI (PostgreSQL).
-- This is NOT an operational authenticator or deployment migration.
-- Supersedes the F87 test's unsafe direct UPDATE permission in this fixture.
BEGIN;
REVOKE UPDATE(state,claim_version,attempts,lease_until)
  ON imagine_comercial_lead_ci.metadata_outbox
  FROM imagine_comercial_lead_ci_worker_a,imagine_comercial_lead_ci_worker_b;

-- Worker A cannot select a tenant, alter the lease duration, reset attempts,
-- or forge an acknowledgment. Only a fixed synthetic organization's event may
-- be claimed. The privileged owner is acceptable ONLY in this throwaway CI DB.
CREATE FUNCTION imagine_comercial_lead_ci.claim_lab_a(
  p_submission uuid,
  p_expected_version bigint
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  next_version bigint;
BEGIN
  IF p_submission IS NULL OR p_expected_version IS NULL
     OR p_expected_version < 0 THEN
    RETURN NULL;
  END IF;
  UPDATE imagine_comercial_lead_ci.metadata_outbox
  SET state='claimed',
      claim_version=claim_version+1,
      attempts=attempts+1,
      lease_until=transaction_timestamp()+interval '60 seconds'
  WHERE organization_reference='11111111-1111-4111-8111-111111111111'::uuid
    AND submission_reference=p_submission
    AND event_kind='pending_review'
    AND claim_version=p_expected_version
    AND attempts<3
    AND (state='queued'
      OR (state='claimed' AND lease_until<transaction_timestamp()))
  RETURNING claim_version INTO next_version;
  RETURN next_version;
END;
$$;

-- CREATE and REVOKE are one transaction, so PUBLIC can never observe an
-- intermediate callable function between commits.
REVOKE ALL ON FUNCTION imagine_comercial_lead_ci.claim_lab_a(uuid,bigint)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION imagine_comercial_lead_ci.claim_lab_a(uuid,bigint)
  TO imagine_comercial_lead_ci_worker_a;
COMMIT;
