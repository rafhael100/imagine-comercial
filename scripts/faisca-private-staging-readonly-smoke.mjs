import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';

// Never send a bearer or API key. This checks ONLY the static private UI,
// after the authorized operator starts the loopback server separately.
if (process.argv.length !== 2) {
  console.error('Uso: node scripts/faisca-private-staging-readonly-smoke.mjs');
  process.exitCode = 2;
} else {
  const result = await inspectFaiscaPrivateReviewUi({
    privateConversationEnabled:
      process.env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === 'YES_SYNTHETIC_ONLY'
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PRIVATE_UI_READONLY_VERIFIED') process.exitCode = 1;
}
