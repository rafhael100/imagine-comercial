-- F88: PRIVILEGE-SEPARATED, CI-ONLY triage view for exhausted leases.
-- security_invoker is essential: the querying worker's RLS is applied rather
-- than the privileged view owner's visibility. PostgreSQL >= 15 required.
CREATE VIEW imagine_comercial_lead_ci.exhausted_claim_review
  WITH (security_invoker=true,security_barrier=true)
AS SELECT organization_reference,submission_reference,claim_version,attempts
FROM imagine_comercial_lead_ci.metadata_outbox
WHERE state='claimed'
  AND attempts>=3
  AND lease_until < transaction_timestamp();

REVOKE ALL ON imagine_comercial_lead_ci.exhausted_claim_review FROM PUBLIC;
GRANT SELECT ON imagine_comercial_lead_ci.exhausted_claim_review
  TO imagine_comercial_lead_ci_worker_a,imagine_comercial_lead_ci_worker_b;

COMMENT ON VIEW imagine_comercial_lead_ci.exhausted_claim_review IS
  'F88 CI-only limited-retries diagnostic; not a dead-letter delivery receipt.';
