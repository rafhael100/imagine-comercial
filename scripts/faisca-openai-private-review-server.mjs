import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

if (process.env.GITHUB_ACTIONS || process.env.CI ||
    process.env.IMAGINE_FAISCA_OPENAI_LIVE_TEST !== 'YES_PAY_SYNTHETIC_ONLY' ||
    !process.env.OPENAI_API_KEY || !process.env.FAISCA_REVIEW_BEARER_TOKEN ||
    !process.env.FAISCA_PRIVATE_LEDGER_DIR) {
  console.error('Private paid review requires deliberate opt-in and both private secret values.');
  process.exitCode = 2;
} else {
  let server;
  try {
    const reservationLedger = createFaiscaLocalReservationLedger({
      directory: process.env.FAISCA_PRIVATE_LEDGER_DIR,
      maxRequests: 100, maxBudgetUsd: 10
    });
    await reservationLedger.ready();
    const trial = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: process.env.OPENAI_API_KEY,
      extendedPrivateSession: true,
      maxRequests: 100,
      maxBudgetUsd: 10,
      reservationLedger
    });
    server = await startFaiscaOpenAIPrivateReview({
      lab: trial,
      reviewToken: process.env.FAISCA_REVIEW_BEARER_TOKEN,
      port: 4336
    });
    // Bind address only, never tokens or the API key.
    console.log('Faísca OpenAI PRIVATE review started on ' + server.address +
      server.path + '; only synthetic case IDs are accepted.');
    console.log('Private HTTP GET/browser calls are not enabled; use authenticated POST.');
    const stop = async () => {
      try { await server.close(); }
      finally { process.exitCode = 0; }
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch {
    console.error('Could not start the private Faísca OpenAI review. Check local secrets and port.');
    process.exitCode = 1;
    await server?.close().catch(() => {});
  }
}
