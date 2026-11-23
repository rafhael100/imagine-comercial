#!/usr/bin/env node
// R291: explicitly invoked local-only read-only summary of holds plus ledger.
// Never a staging attestation, paid-call entitlement, or public release gate.
import { reviewFaiscaPrivateLocalLedgerAndHolds }
  from '../ops/faisca/openai/private-ledger-combined-review.mjs';

function options(args) {
  if (args.length !== 3) throw new Error('Exact operator options required.');
  const entries = new Map();
  for (const arg of args) {
    const separator = arg.indexOf('=');
    const key = arg.slice(0, separator);
    if (separator < 0 ||
        !['--directory', '--max-requests', '--max-budget-usd'].includes(key) ||
        entries.has(key) || arg.length > 4096) {
      throw new Error('Invalid operator options.');
    }
    entries.set(key, arg.slice(separator + 1));
  }
  const requests = entries.get('--max-requests') ?? '';
  const budget = entries.get('--max-budget-usd') ?? '';
  if (!entries.get('--directory') ||
      !/^[1-9][0-9]{0,2}$/.test(requests) ||
      !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(budget)) {
    throw new Error('Unsafe operator options.');
  }
  return {
    directory: entries.get('--directory'),
    maxRequests: Number(requests),
    maxBudgetUsd: Number(budget)
  };
}

async function main() {
  if (process.env.CI === 'true' ||
      process.env.GITHUB_ACTIONS === 'true' ||
      process.env.FAISCA_PRIVATE_LEDGER_COMBINED_REVIEW !== 'REVIEW_ONLY') {
    throw new Error('Operator-only review required.');
  }
  const report = await reviewFaiscaPrivateLocalLedgerAndHolds(
    options(process.argv.slice(2))
  );
  // Schema contains only fixed status strings, booleans, two safe integers
  // or null. Paths, user input and unexpected error details stay private.
  process.stdout.write(JSON.stringify(report) + '\n');
}

main().catch(() => {
  process.stderr.write('Private combined ledger review unavailable; manual review required.\n');
  process.exitCode = 1;
});
