#!/usr/bin/env node
// R290: operator-only local NO-START marker survey. No Docker, network,
// billing, file writes, provider API or ability to clear durable holds.
import { inspectFaiscaLocalPrivateHoldsReadOnly }
  from '../ops/faisca/openai/private-ledger-hold-inspection.mjs';

async function run() {
  if (process.env.GITHUB_ACTIONS === 'true' ||
      process.env.CI === 'true' ||
      process.env.FAISCA_PRIVATE_HOLD_INSPECTION !== 'REVIEW_ONLY' ||
      process.argv.length !== 3 ||
      !process.argv[2].startsWith('--directory=') ||
      process.argv[2].length > 4096) {
    throw new Error('Operator-only local hold review required.');
  }
  const directory = process.argv[2].slice('--directory='.length);
  const report = await inspectFaiscaLocalPrivateHoldsReadOnly({ directory });
  // Fixed-schema booleans only; no marker content, local paths or secrets.
  process.stdout.write(JSON.stringify(report) + '\n');
}

run().catch(() => {
  process.stderr.write('Private hold inspection unavailable; manual review required.\n');
  process.exitCode = 1;
});
