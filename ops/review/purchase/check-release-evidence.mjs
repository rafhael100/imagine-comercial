/**
 * Offline release-evidence validator for Imagine Comercial.
 * Evidence does not deploy, approve, provision, or call external services.
 * Usage: node ops/review/purchase/check-release-evidence.mjs path/to/evidence.json
 */
import { readFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";

export const REQUIRED_GATES = Object.freeze([
  "commercial_build_and_accessibility",
  "customer_login_and_recovery",
  "approved_catalog_prices_and_terms",
  "asaas_sandbox_and_verified_webhooks",
  "order_ownership_idempotency_and_ledger",
  "invoice_and_site_provisioning",
  "private_vps_backup_restore_and_rollback",
  "independent_security_privacy_review"
]);

const COMMIT = /^[0-9a-f]{40}$/;
const EVIDENCE = /^https:\/\/github\.com\/rafhael100\/(?:imagine-comercial|imagine-portal|imagine-sites|imagine-crm)\/(?:actions\/runs\/[0-9]+|pull\/[0-9]+)(?:#[-a-zA-Z0-9]+)?$/;

export function evaluateReleaseEvidence(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return { ready: false, errors: ["Evidence must be an object"] };
  }
  if (document.environment !== "production") errors.push("Target must explicitly be production");
  if (document.releaseApproval !== "approved-by-operator") errors.push("Explicit operator approval absent");
  if (!COMMIT.test(document.comercialCommit ?? "")) errors.push("Exact Comercial commit absent");
  if (!COMMIT.test(document.portalCommit ?? "")) errors.push("Exact Portal commit absent");
  if (!Array.isArray(document.gates) || document.gates.length !== REQUIRED_GATES.length) {
    errors.push("All eight gates must be present, once each");
  }
  const seen = new Set();
  for (const gate of Array.isArray(document.gates) ? document.gates : []) {
    if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
      errors.push("Malformed gate"); continue;
    }
    if (seen.has(gate.id)) errors.push("Duplicate gate: " + gate.id);
    seen.add(gate.id);
    if (!REQUIRED_GATES.includes(gate.id)) errors.push("Unknown gate: " + String(gate.id));
    if (gate.status !== "pass") errors.push("Gate not passed: " + String(gate.id));
    if (!Array.isArray(gate.evidence) || gate.evidence.length === 0 ||
        gate.evidence.some(url => typeof url !== "string" || !EVIDENCE.test(url))) {
      errors.push("Trusted GitHub evidence URL missing: " + String(gate.id));
    }
    if (!COMMIT.test(gate.verifiedCommit ?? "")) errors.push("Verified commit absent: " + String(gate.id));
  }
  for (const id of REQUIRED_GATES) if (!seen.has(id)) errors.push("Missing gate: " + id);
  // This local check checks evidence syntax and completeness, NOT authenticity
  // of remote CI, legality, PSP, security or business acceptance.
  return { ready: errors.length === 0, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    if (process.argv.length !== 3) throw Error("Usage: check-release-evidence.mjs <evidence.json>");
    const p = resolve(process.argv[2]);
    if (!lstatSync(p).isFile()) throw Error("Evidence must be a regular file");
    const evidence = JSON.parse(readFileSync(p, "utf8"));
    const outcome = evaluateReleaseEvidence(evidence);
    if (!outcome.ready) {
      console.error("NO-GO: " + outcome.errors.join("; "));
      process.exitCode = 1;
    } else {
      console.log("EVIDENCE INVENTORY COMPLETE — MANUAL REVIEW REQUIRED; NO DEPLOY AUTHORIZED");
    }
  } catch (error) {
    console.error("NO-GO: " + error.message);
    process.exitCode = 1;
  }
}
