import { createPublicKey, verify as verifySignature } from 'node:crypto';

/**
 * R175: verify an independently signed human review of THREE numeric evidence
 * digests for ONE synthetic private trial. This binds a reviewer's signature,
 * the code HEAD, trial nonce, outcome and byte pins without loading any prompt,
 * account export, API token or provider credential.
 *
 * A signed HUMAN assertion is not an OpenAI-signed receipt, invoice, trusted
 * provider usage export, public readiness or proof of staging installation.
 * Replay protection also requires an independent single-use nonce register.
 */
export const FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA =
  'faisca.private-independent-numeric-review.v1';

const OUTCOMES = new Set(['success', 'rejected', 'failed_luna', 'failed_terra']);
const SOURCE = 'operator_manual_numeric_provider_comparison_not_provider_attested';
const keys = value => Object.keys(value).sort().join(',');
const plain = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const sha = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const validPins = value => plain(value) &&
  keys(value) === 'after,aggregate,before' &&
  sha(value.after) && sha(value.aggregate) && sha(value.before);
const validDate = value => {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value
    ? date.getTime() : null;
};

/**
 * Inputs expectedSha, expectedPins, expectedOutcome, expectedNonce and the
 * reviewer's public key MUST come from separately trusted operator channels.
 * Never copy trust pins from the witness itself and call that verification.
 * The nonce cannot be marked consumed here: this verifier is read-only.
 */
export function verifyFaiscaIndependentNumericReview({
  witness, expectedSha, expectedPins, expectedOutcome, expectedNonce,
  reviewerPublicKeyPem, nowMs = Date.now()
} = {}) {
  try {
    if (!plain(witness) || keys(witness) !== 'signature,statement' ||
        !plain(witness.statement) ||
        keys(witness.statement) !==
          'expiresAt,headSha,nonce,operationalEffects,outcome,pins,publicReady,reviewedAt,schema,source' ||
        !validPins(expectedPins) ||
        typeof expectedSha !== 'string' || !/^[0-9a-f]{40}$/u.test(expectedSha) ||
        !OUTCOMES.has(expectedOutcome) ||
        typeof expectedNonce !== 'string' || !/^[0-9a-f]{32}$/u.test(expectedNonce) ||
        typeof reviewerPublicKeyPem !== 'string' ||
        reviewerPublicKeyPem.length < 80 || reviewerPublicKeyPem.length > 4096 ||
        !Number.isSafeInteger(nowMs) || nowMs < 0) return false;

    const statement = witness.statement;
    if (statement.schema !== FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA ||
        statement.source !== SOURCE ||
        statement.operationalEffects !== false || statement.publicReady !== false ||
        statement.headSha !== expectedSha || statement.outcome !== expectedOutcome ||
        statement.nonce !== expectedNonce ||
        !validPins(statement.pins) ||
        ['before', 'after', 'aggregate'].some(key => statement.pins[key] !== expectedPins[key])) {
      return false;
    }
    const reviewed = validDate(statement.reviewedAt);
    const expires = validDate(statement.expiresAt);
    if (reviewed === null || expires === null || reviewed > nowMs + 5 * 60_000 ||
        reviewed < nowMs - 24 * 60 * 60_000 || expires <= nowMs ||
        expires <= reviewed || expires - reviewed > 4 * 60 * 60_000) return false;

    if (typeof witness.signature !== 'string' ||
        witness.signature.length !== 88 ||
        !/^[A-Za-z0-9+/]{86}==$/u.test(witness.signature)) return false;
    const signature = Buffer.from(witness.signature, 'base64');
    if (signature.length !== 64 ||
        signature.toString('base64') !== witness.signature) return false;

    const publicKey = createPublicKey(reviewerPublicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') return false;
    const canonical = Buffer.from(JSON.stringify(statement) + '\n', 'utf8');
    return canonical.length <= 1024 &&
      verifySignature(null, canonical, publicKey, signature);
  } catch {
    // No parsing error, public key, signature, source fields or private path
    // should be printed in CLI/browser/logs.
    return false;
  }
}
