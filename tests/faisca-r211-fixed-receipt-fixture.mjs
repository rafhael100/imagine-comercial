import { FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

// Deterministic, public-editorial-only fixtures. No paid calls or customer data.
export function reviewedFixedReceiptSources(caseId = 'compare') {
  if (!Object.hasOwn(FAISCA_OPENAI_TEST_CASES, caseId)) {
    throw new TypeError('Only reviewed fixed synthetic cases are supported.');
  }
  const candidate = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES[caseId])[0];
  const sources = getGroundedAnswer(candidate)?.sources.map(source => source.id);
  if (!sources?.length) throw new Error('No pinned editorial receipt for the fixture.');
  return sources;
}
