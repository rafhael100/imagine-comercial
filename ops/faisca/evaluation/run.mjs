import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createSession, respond } from '../core.mjs';
import { groundedRespond } from '../grounding/guide.mjs';
import { routeWithLocalFixture } from '../model-router/contract.mjs';
import { SYNTHETIC_EVALUATION_SCHEMA, SYNTHETIC_EVALUATION_CASES } from './scenarios.mjs';

const CATEGORIES = Object.freeze(['private', 'fixed', 'public', 'unsupported', 'sensitive']);
const emptyTotals = () => Object.fromEntries(CATEGORIES.map(name => [name, { total: 0, passed: 0, failed: 0 }]));

/**
 * Fail-closed synthetic-only evaluation. The report contains case IDs and check
 * codes, never visitor text, fixture PII, generated answers or customer data.
 */
export function evaluateSyntheticCases(cases = SYNTHETIC_EVALUATION_CASES) {
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 100) {
    throw new TypeError('A finite synthetic evaluation set is required.');
  }
  const counts = emptyTotals(), failures = [], usedIds = new Set();
  let passed = 0;
  for (const [index, fixture] of cases.entries()) {
    if (!fixture || typeof fixture !== 'object' ||
        typeof fixture.id !== 'string' || !/^[a-z0-9_]{1,64}$/.test(fixture.id) ||
        usedIds.has(fixture.id) || !CATEGORIES.includes(fixture.kind) ||
        typeof fixture.text !== 'string' || fixture.text.length < 1 || fixture.text.length > 800) {
      throw new TypeError('Invalid synthetic evaluation fixture.');
    }
    usedIds.add(fixture.id);
    counts[fixture.kind].total++;
    const checks = [];
    const safeInput = { type: 'text', text: fixture.text };
    const guided = respond(createSession(), safeInput);
    const routed = routeWithLocalFixture({
      conversationId: 'r14_synthetic_eval_' + index,
      messageId: 'r14_case_' + index,
      userText: fixture.text
    });
    if (guided.reply.intent !== fixture.coreIntent) checks.push('core_intent_mismatch');
    if (routed.routeStatus !== fixture.routeStatus) checks.push('route_status_mismatch');
    if (fixture.kind === 'private') {
      const grounded = groundedRespond(createSession(), safeInput);
      if (grounded.reply.intent !== 'grounding_boundary' ||
          grounded.reply.sources.length !== 0) checks.push('grounded_private_boundary_mismatch');
      if (routed.accepted !== true || routed.provenance !== 'host_fixed_boundary' ||
          routed.sources.length !== 0 || routed.actions.length !== 0 ||
          routed.candidateAnswerIds.length !== 0) checks.push('private_route_not_fixed');
    } else if (fixture.kind === 'fixed') {
      if (routed.accepted !== true || routed.provenance !== 'host_fixed_boundary' ||
          routed.sources.length !== 0 || routed.actions.length !== 0) checks.push('fixed_route_not_closed');
    } else if (fixture.kind === 'public') {
      if (routed.accepted !== true || routed.answerId !== fixture.answerId ||
          routed.provenance !== 'r06_verified_editorial' ||
          !Array.isArray(routed.sources) || routed.sources.length === 0) {
        checks.push('public_editorial_mismatch');
      }
    } else if (fixture.kind === 'unsupported') {
      if (routed.accepted !== true || routed.sources.length !== 0 ||
          routed.actions.length !== 0 || routed.provenance !== 'host_fixed_fallback') {
        checks.push('unsupported_not_fixed');
      }
    } else if (fixture.kind === 'sensitive') {
      if (routed.accepted !== false || routed.sources.length !== 0 ||
          routed.actions.length !== 0 || routed.candidateAnswerIds.length !== 0 ||
          !['sensitive_input', 'unsupported_instruction'].includes(guided.reply.intent)) {
        checks.push('sensitive_not_refused');
      }
    }
    if (checks.length) {
      counts[fixture.kind].failed++;
      failures.push(Object.freeze({ caseId: fixture.id, checkCodes: Object.freeze(checks) }));
    } else {
      counts[fixture.kind].passed++;
      passed++;
    }
  }
  return Object.freeze({
    schema: SYNTHETIC_EVALUATION_SCHEMA,
    suiteVersion: 'r14-1',
    scope: 'synthetic_fixture_only',
    totalCases: cases.length,
    passed, failed: cases.length - passed,
    categories: Object.freeze(Object.fromEntries(
      CATEGORIES.map(name => [name, Object.freeze({ ...counts[name] })]))),
    failedCases: Object.freeze(failures),
    externalModelInvocations: 0, operationalEffects: false,
    productionReadiness: false
  });
}

export function runSyntheticFaiscaEvaluation() {
  return evaluateSyntheticCases(SYNTHETIC_EVALUATION_CASES);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--synthetic') {
    process.stderr.write('Somente: node ops/faisca/evaluation/run.mjs --synthetic\n');
    process.exitCode = 2;
  } else {
    const report = runSyntheticFaiscaEvaluation();
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.failed > 0) process.exitCode = 1;
  }
}
