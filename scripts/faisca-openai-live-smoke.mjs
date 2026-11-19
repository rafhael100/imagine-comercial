import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';

// This CLI is deliberately NOT a public server or a GitHub Actions workflow.
// It makes two paid API calls at most, exclusively with one of the synthetic
// reviewed questions below, after a conscious private operator opt-in.
const caseId = process.argv[2] ?? 'compare';
if (process.env.GITHUB_ACTIONS || process.env.CI ||
    process.env.IMAGINE_FAISCA_OPENAI_LIVE_TEST !== 'YES_PAY_SYNTHETIC_ONLY') {
  console.error('Real API testing is disabled outside an authorized private local session.');
  process.exitCode = 2;
} else if (!Object.hasOwn(FAISCA_OPENAI_TEST_CASES, caseId)) {
  console.error('Select a synthetic case: compare, process or pricing.');
  process.exitCode = 2;
} else if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in private server environment; never put keys in code or chat.');
  process.exitCode = 2;
} else {
  const trial = createFaiscaOpenAILiveLab({
    enabled: true,
    apiKey: process.env.OPENAI_API_KEY,
    maxBudgetUsd: 0.01,
    timeoutMs: 12000
  });
  try {
    const outcome = await trial.answer(caseId);
    // Only fictional prompt, reviewed source IDs and a draft response reach
    // stdout. No request/response headers, API key, auth details or raw API
    // error are printed. This is NOT publication approval.
    console.log(JSON.stringify({
      laboratory: 'private-openai-api',
      caseId,
      syntheticQuestion: FAISCA_OPENAI_TEST_CASES[caseId],
      status: outcome.status,
      draftAnswer: outcome.text,
      editorialSourceIds: outcome.sourceIds ?? [],
      reviewedModelIds: outcome.modelIds ?? ['gpt-6-luna'],
      estimatedReservedUsd: Number(trial.inspect().reservedUsd.toFixed(6)),
      requiresEditorialReview: true,
      publicReady: false,
      operationalEffects: false
    }, null, 2));
  } catch {
    console.error('OpenAI private test failed safely. Check private API access, billing and model permissions.');
    process.exitCode = 1;
  }
}
