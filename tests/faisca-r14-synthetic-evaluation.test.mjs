import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNTHETIC_EVALUATION_CASES } from '../ops/faisca/evaluation/scenarios.mjs';
import { evaluateSyntheticCases, runSyntheticFaiscaEvaluation } from '../ops/faisca/evaluation/run.mjs';

test('R14 synthetic evaluation has representative finite coverage and zero drift', () => {
  const report = runSyntheticFaiscaEvaluation();
  assert.equal(report.schema, 'faisca.evaluation.synthetic.v1');
  assert.equal(report.scope, 'synthetic_fixture_only');
  assert.equal(report.totalCases, SYNTHETIC_EVALUATION_CASES.length);
  assert.ok(report.totalCases >= 24);
  assert.equal(report.failed, 0, JSON.stringify(report.failedCases));
  assert.equal(report.passed, report.totalCases);
  assert.deepEqual(report.failedCases, []);
  assert.ok(report.categories.private.total >= 10);
  assert.ok(report.categories.public.total >= 5);
  assert.ok(report.categories.sensitive.total >= 3);
  assert.equal(report.externalModelInvocations, 0);
  assert.equal(report.operationalEffects, false);
  assert.equal(report.productionReadiness, false);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.categories), true);
});

test('R14 a wrong closed-route expectation fails with only an ID and check code', () => {
  const scenario = { ...SYNTHETIC_EVALUATION_CASES[0], routeStatus: 'grounded' };
  const report = evaluateSyntheticCases([scenario]);
  assert.equal(report.totalCases, 1);
  assert.equal(report.passed, 0);
  assert.equal(report.failed, 1);
  assert.deepEqual(report.failedCases, [
    { caseId: 'private_01', checkCodes: ['route_status_mismatch'] }
  ]);
  assert.equal(JSON.stringify(report).includes(scenario.text), false);
});

test('R14 report never includes original questions or synthetic PII', () => {
  const report = runSyntheticFaiscaEvaluation();
  const output = JSON.stringify(report);
  for (const scenario of SYNTHETIC_EVALUATION_CASES) {
    assert.equal(output.includes(scenario.text), false, scenario.id);
  }
  assert.doesNotMatch(output, /99999|EXEMPLO_SINTETICO|segunda via do recibo/i);
  assert.equal(Object.isFrozen(report.failedCases), true);
  assert.equal(Object.isFrozen(report.categories.private), true);
});

test('R14 evaluation rejects duplicate identifiers, malformed entries and oversized sets', () => {
  const first = SYNTHETIC_EVALUATION_CASES[0];
  assert.throws(() => evaluateSyntheticCases([]), TypeError);
  assert.throws(() => evaluateSyntheticCases([first, first]), TypeError);
  assert.throws(() => evaluateSyntheticCases([{ ...first, id: '../secret' }]), TypeError);
  assert.throws(() => evaluateSyntheticCases([{ ...first, text: 'a'.repeat(801) }]), TypeError);
  assert.throws(() => evaluateSyntheticCases(Array.from({ length: 101 }, (_, index) =>
    ({ ...first, id: 'too_many_' + index }))), TypeError);
});
