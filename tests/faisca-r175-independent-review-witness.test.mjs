import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA,
  verifyFaiscaIndependentNumericReview
} from '../ops/faisca/openai/private-independent-review-witness.mjs';

const nowMs = Date.parse('2026-11-21T10:00:00.000Z');
const head = 'a'.repeat(40);
const nonce = 'b'.repeat(32);
const pins = {
  before: '1'.repeat(64), after: '2'.repeat(64), aggregate: '3'.repeat(64)
};
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const reviewerPublicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

function makeWitness(overrides = {}) {
  const statement = {
    schema: FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA,
    source: 'operator_manual_numeric_provider_comparison_not_provider_attested',
    headSha: head, outcome: 'success', nonce, pins: { ...pins },
    reviewedAt: '2026-11-21T09:30:00.000Z',
    expiresAt: '2026-11-21T12:00:00.000Z',
    publicReady: false, operationalEffects: false, ...overrides
  };
  return {
    statement,
    signature: sign(null, Buffer.from(JSON.stringify(statement) + '\n'), privateKey).toString('base64')
  };
}
const options = witness => ({
  witness, expectedSha: head, expectedPins: pins, expectedOutcome: 'success',
  expectedNonce: nonce, reviewerPublicKeyPem, nowMs
});

test('R175 verifies an ephemeral Ed25519 human review bound to trial, outcome, code HEAD and all three independent byte pins', () => {
  const witness = makeWitness();
  assert.equal(verifyFaiscaIndependentNumericReview(options(witness)), true);
  assert.equal(witness.statement.publicReady, false);
  assert.equal(witness.statement.operationalEffects, false);
  assert.equal(witness.statement.source.includes('not_provider_attested'), true);
  assert.equal(Object.keys(witness).sort().join(','), 'signature,statement');
});

test('R175 rejects swapped evidences, trial/head/outcome drift, invalid and other reviewer signatures', () => {
  const witness = makeWitness();
  for (const changes of [
    { expectedSha: 'f'.repeat(40) },
    { expectedPins: { ...pins, aggregate: '9'.repeat(64) } },
    { expectedPins: { ...pins, extra: '9'.repeat(64) } },
    { expectedOutcome: 'failed_terra' },
    { expectedNonce: 'c'.repeat(32) },
    { nowMs: nowMs + 10 * 60 * 60_000 },
    { reviewerPublicKeyPem: generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }) }
  ]) assert.equal(verifyFaiscaIndependentNumericReview({ ...options(witness), ...changes }), false);
  const corrupted = { ...witness, signature: (witness.signature[0] === 'A' ? 'B' : 'A') + witness.signature.slice(1) };
  assert.equal(verifyFaiscaIndependentNumericReview(options(corrupted)), false);
});

test('R175 refuses forged authority, extra identifiers, stale/future attestations and malformed keys', () => {
  for (const overrides of [
    { source: 'openai_api_signed' }, { publicReady: true },
    { operationalEffects: true }, { email: 'operator@example.invalid' },
    { reviewedAt: '2026-11-20T08:00:00.000Z' },
    { reviewedAt: '2026-11-21T10:06:00.000Z' },
    { expiresAt: '2026-11-21T14:00:00.000Z' },
    { expiresAt: '2026-11-21T09:00:00.000Z' },
    { pins: { ...pins, aggregate: '0'.repeat(64) } }
  ]) assert.equal(verifyFaiscaIndependentNumericReview(options(makeWitness(overrides))), false);
  assert.equal(verifyFaiscaIndependentNumericReview(options({})), false);
  assert.equal(verifyFaiscaIndependentNumericReview({
    ...options(makeWitness()), reviewerPublicKeyPem: 'not a key'
  }), false);
  assert.equal(verifyFaiscaIndependentNumericReview({
    ...options(makeWitness()), reviewerPublicKeyPem:
      generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' })
  }), false);
});

test('R175 must refuse self-authorizing witness, even if signature is valid', () => {
  const witness = makeWitness();
  assert.equal(verifyFaiscaIndependentNumericReview({
    witness, expectedSha: head, expectedPins: pins, expectedOutcome: 'success',
    expectedNonce: undefined, reviewerPublicKeyPem, nowMs
  }), false);
  assert.equal(verifyFaiscaIndependentNumericReview({
    ...options(witness), expectedPins: undefined
  }), false);
});
