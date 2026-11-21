import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA } from '../ops/faisca/openai/private-independent-review-witness.mjs';

function snapshot(requests, reservedMicros) {
  return {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests, reservedMicros, limitRequests: 3, limitMicros: 1000000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r178-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkout = join(root, 'checkout');
  const evidence = join(root, 'evidence');
  const registry = join(root, 'registry');
  await mkdir(join(checkout, 'ops', 'faisca'), { recursive: true });
  await mkdir(join(checkout, 'scripts'));
  await mkdir(evidence, { mode: 0o700 });
  await mkdir(registry, { mode: 0o700 });
  await chmod(evidence, 0o700);
  await chmod(registry, 0o700);
  // A fresh, synthetic, locally committed checkout tests the REAL CLI's
  // HEAD/index/dirty-tree gates without bypassing the prohibition on CI runs.
  await cp(new URL('../ops/faisca/openai/', import.meta.url),
    join(checkout, 'ops', 'faisca', 'openai'), { recursive: true });
  await cp(new URL('../scripts/faisca-private-provider-offline-audit.mjs', import.meta.url),
    join(checkout, 'scripts', 'faisca-private-provider-offline-audit.mjs'));
  function git(args) {
    return execFileSync('/usr/bin/git', args, {
      cwd: checkout, encoding: 'utf8', timeout: 5000,
      env: { PATH: '/usr/bin:/bin', HOME: root, LANG: 'C', LC_ALL: 'C' }
    }).trim();
  }
  git(['init', '-q']);
  git(['add', 'ops', 'scripts']);
  git(['-c', 'user.name=Synthetic Fixture', '-c',
    'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture only']);
  const sha = git(['rev-parse', 'HEAD']);
  assert.match(sha, /^[0-9a-f]{40}$/u);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all']), '');
  const data = {
    before: snapshot(0, 0),
    after: snapshot(2, 40000),
    aggregate: {
      schema: 'faisca.private-provider-aggregate-evidence.v1',
      scope: 'isolated_private_review_only', lunaRequests: 1,
      terraRequests: 1, totalRequests: 2, actualCostMicros: 10000,
      publicReady: false, operationalEffects: false
    }
  };
  const pins = {};
  for (const [name, value] of Object.entries(data)) {
    const raw = JSON.stringify(value) + '\n';
    await writeFile(join(evidence, name + '.json'), raw, { mode: 0o600 });
    pins[name] = createHash('sha256').update(raw).digest('hex');
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const nonce = 'a'.repeat(32);
  const statement = {
    schema: FAISCA_PRIVATE_REVIEW_WITNESS_SCHEMA,
    source: 'operator_manual_numeric_provider_comparison_not_provider_attested',
    headSha: sha, outcome: 'success', nonce, pins,
    reviewedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    publicReady: false, operationalEffects: false
  };
  const witness = JSON.stringify({
    statement,
    signature: sign(null, Buffer.from(JSON.stringify(statement) + '\n'), privateKey)
      .toString('base64')
  });
  const shared = {
    PATH: '/usr/bin:/bin', HOME: root, LANG: 'C', LC_ALL: 'C',
    CI: '', GITHUB_ACTIONS: '',
    FAISCA_PRIVATE_PROVIDER_AUDIT_ACK: 'YES_OFFLINE_NUMERIC_REVIEW_ONLY',
    FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY: evidence,
    FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON: JSON.stringify(pins)
  };
  const signed = {
    ...shared,
    FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON: witness,
    FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_PUBKEY_PEM:
      publicKey.export({ type: 'spki', format: 'pem' }),
    FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE: nonce,
    FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE_DIRECTORY: registry
  };
  function run(env = signed) {
    return spawnSync(process.execPath, [
      'scripts/faisca-private-provider-offline-audit.mjs', sha, 'success'
    ], { cwd: checkout, encoding: 'utf8', timeout: 10000, env });
  }
  return { root, checkout, evidence, registry, data, pins, sha, nonce, witness,
    shared, signed, run };
}

test('R178 real CLI accepts one signed synthetic operator audit and blocks identical replay after restart', async t => {
  const s = await fixture(t);
  const first = s.run();
  assert.equal(first.status, 2, first.stderr);
  const report = JSON.parse(first.stdout);
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(report.localRequests, 2);
  assert.equal(report.independentReviewWitnessVerified, true);
  assert.equal(report.externalAttestationVerified, false);
  assert.equal(report.providerUsageReconciled, false);
  assert.equal(report.publicReady, false);
  assert.equal(report.operationalEffects, false);
  assert.equal((await readdir(s.registry)).length, 1);
  const replay = s.run();
  assert.equal(replay.status, 2);
  assert.equal(replay.stdout, '');
  assert.match(replay.stderr, /R177 BLOCKED/u);
  assert.equal((await readdir(s.registry)).length, 1);
  for (const raw of [first.stdout, first.stderr, replay.stdout, replay.stderr]) {
    for (const secret of [s.nonce, s.evidence, s.registry, s.witness, 'BEGIN PUBLIC KEY']) {
      assert.equal(raw.includes(secret), false);
    }
  }
});

test('R178 unsigned path explicitly remains unverified; signed partial or forged inputs cannot consume a nonce', async t => {
  const s = await fixture(t);
  const unsigned = s.run(s.shared);
  assert.equal(unsigned.status, 2, unsigned.stderr);
  assert.equal(JSON.parse(unsigned.stdout).independentReviewWitnessVerified, false);
  assert.equal(JSON.parse(unsigned.stdout).publicReady, false);
  assert.equal((await readdir(s.registry)).length, 0);
  const cases = [
    { ...s.signed, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE_DIRECTORY: '' },
    { ...s.shared, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE_DIRECTORY: s.registry },
    { ...s.signed, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON:
      s.witness.replace(/"publicReady":false/u, '"publicReady":true') },
    { ...s.signed, FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE: 'f'.repeat(32) }
  ];
  for (const env of cases) {
    const result = s.run(env);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /R167 BLOCKED/u);
    assert.equal(result.stderr.includes(s.registry), false);
    assert.equal(result.stderr.includes(s.nonce), false);
  }
  assert.equal((await readdir(s.registry)).length, 0);
});

test('R178 independently pinned evidence is mandatory before the signed single-use nonce is spent', async t => {
  const s = await fixture(t);
  await writeFile(join(s.evidence, 'aggregate.json'),
    JSON.stringify({ ...s.data.aggregate, actualCostMicros: 11000 }) + '\n');
  const invalid = s.run();
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /R167 BLOCKED/u);
  assert.equal((await readdir(s.registry)).length, 0);
  // The negative test must not alter checkout or write outside temp paths.
  const script = await readFile(join(s.checkout, 'scripts',
    'faisca-private-provider-offline-audit.mjs'), 'utf8');
  assert.match(script, /NO-GO/u);
});
