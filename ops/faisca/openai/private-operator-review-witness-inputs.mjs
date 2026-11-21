import { verifyFaiscaIndependentNumericReview } from './private-independent-review-witness.mjs';

// R176: no credentials are read. These four fields may be provisioned to an
// authorized operator through independent trusted private channels. A partial
// or invalid attempt MUST fail closed rather than silently downgrading to an
// unsigned audit. No witness material or exception text is ever returned.
const fields = Object.freeze([
  'FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON',
  'FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_PUBKEY_PEM',
  'FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE'
]);

export function inspectFaiscaOperatorWitnessInputs({
  env, sha, outcome, expectedSha256, nowMs = Date.now()
} = {}) {
  try {
    if (env === null || typeof env !== 'object') {
      return Object.freeze({ allowed: false, verified: false });
    }
    const present = fields.filter(key => Object.hasOwn(env, key));
    if (present.length === 0) {
      // Legacy numeric-only audit stays possible and visibly UNATTESTED.
      // Its status remains pending independent review, never public GO.
      return Object.freeze({ allowed: true, verified: false });
    }
    if (present.length !== fields.length) {
      return Object.freeze({ allowed: false, verified: false });
    }
    const raw = env[fields[0]];
    const reviewerPublicKeyPem = env[fields[1]];
    const expectedNonce = env[fields[2]];
    if (typeof raw !== 'string' || raw.length < 100 || raw.length > 2200 ||
        typeof reviewerPublicKeyPem !== 'string' || reviewerPublicKeyPem.length > 4096 ||
        typeof expectedNonce !== 'string' || expectedNonce.length !== 32) {
      return Object.freeze({ allowed: false, verified: false });
    }
    const witness = JSON.parse(raw);
    const verified = verifyFaiscaIndependentNumericReview({
      witness, expectedSha: sha, expectedPins: expectedSha256,
      expectedOutcome: outcome, expectedNonce, reviewerPublicKeyPem, nowMs
    });
    return Object.freeze({ allowed: verified, verified });
  } catch {
    return Object.freeze({ allowed: false, verified: false });
  }
}
