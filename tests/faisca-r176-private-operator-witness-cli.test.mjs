import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { inspectFaiscaOperatorWitnessInputs } from '../ops/faisca/openai/private-operator-review-witness-inputs.mjs';
import { FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA } from '../ops/faisca/openai/private-independent-review-witness.mjs';

const nowMs = Date.parse('2026-11-21T10:00:00.000Z');
const sha = 'a'.repeat(40), nonce = 'b'.repeat(32);
const expectedSha256 = {
  before: '1'.repeat(64), after: '2'.repeat(64), aggregate: '3'.repeat(64)
};
const kp = generateKeyPairSync('ed25519');
const pem = kp.publicKey.export({ type: 'spki', format: 'pem' });
function signed(overrides = {}) {
  const statement = {
    schema: FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA,
    source: 'operator_manual_numeric_provider_comparison_not_provider_attested',
    headSha: sha, outcome: 'success', nonce, pins: { ...expectedSha256 },
    reviewedAt: '2026-11-21T09:30:00.000Z',
    expiresAt: '2026-11-21T12:00:00.000Z',
    publicReady: false, operationalEffects: false, ...overrides
  };
  return JSON.stringify({
    statement, signature: sign(null, Buffer.from(JSON.stringify(statement) + '\n'), kp.privateKey).toString('base64')
  });
}
function operatorInputs(env) {
  return inspectFaiscaOperatorWitnessInputs({
    env, sha, outcome: 'success', expectedSha256, nowMs
  });
}
function operatorEnv() {
  return {
    FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON: signed(),
    FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_PUBKEY_PEM: pem,
    FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE: nonce
  };
}

test('R176 optional signed review verification is explicit and preserves unsigned pending review', () => {
  assert.deepEqual(operatorInputs({}), { allowed: true, verified: false });
  assert.deepEqual(operatorInputs(operatorEnv()), { allowed: true, verified: true });
  assert.deepEqual(operatorInputs(null), { allowed: false, verified: false });
});

test('R176 partial, malformed, forged, expired or mismatched operator input blocks rather than downgrades', () => {
  const good = operatorEnv();
  for (const bad of [
    { FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE: nonce },
    { ...good, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE: 'c'.repeat(32) },
    { ...good, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_PUBKEY_PEM: 'unsafe' },
    { ...good, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON: 'not json' },
    { ...good, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON: signed({ expiresAt: '2026-11-21T09:00:00.000Z' }) },
    { ...good, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON: 'x'.repeat(3000) },
    { ...good, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON: JSON.stringify({
      ...JSON.parse(signed()), credential: 'synthetic-secret-marker'
    }) }
  ]) assert.deepEqual(operatorInputs(bad), { allowed: false, verified: false });
});

test('R176 CLI validates signed witness before reading offline evidence and never changes public GO', async () => {
  const raw = await readFile(new URL('../scripts/faisca-private-provider-offline-audit.mjs', import.meta.url), 'utf8');
  assert.match(raw, /inspectFaiscaOperatorWitnessInputs/u);
  assert.ok(raw.indexOf('const witnessGate = inspectFaiscaOperatorWitnessInputs') <
    raw.indexOf('inspectFaiscaOfflineOperatorAggregate({'));
  assert.match(raw, /!witnessGate\.allowed/u);
  assert.match(raw, /independentReviewWitnessVerified: witnessGate\.verified/u);
  assert.match(raw, /report\.status === 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW' \? 2 : 1/u);
  assert.match(raw, /publicFaiscaEnabled/u.test(raw) ? /publicFaiscaEnabled/u : /NO-GO/u);
});

test('R176 CLI refuses CI and never exposes signed witness, nonce, path or public key', () => {
  const marker = 'synthetic-review-credential-marker';
  const result = spawnSync(process.execPath, [
    'scripts/faisca-private-provider-offline-audit.mjs', sha, 'success'
  ], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env, CI: 'true',
      FAISCA_PRIVATE_PROVIDER_AUDIT_ACK: 'YES_OFFLINE_NUMERIC_REVIEW_ONLY',
      FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY: '/private/' + marker,
      FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON: JSON.stringify(expectedSha256),
      FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON: signed(),
      FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_PUBKEY_PEM: pem,
      FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE: nonce
    },
    encoding: 'utf8', timeout: 5000
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /R167 BLOCKED/u);
  assert.equal(result.stderr.includes(marker), false);
  assert.equal(result.stderr.includes(nonce), false);
  assert.equal(result.stderr.includes('BEGIN PUBLIC KEY'), false);
});
