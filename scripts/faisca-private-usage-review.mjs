#!/usr/bin/env node
// R288 — operator-only, OFFLINE, read-only comparison; NEVER a billing receipt.
// Accepts aggregate integers over stdin (never prompts, keys, accounts or logs).
// No network, OpenAI client, Docker/VPS access, writes, unlocks or public flag.
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { reviewFaiscaPrivateUsage } from '../ops/faisca/openai/private-usage-review.mjs';

async function readAggregate() {
  if (process.stdin.isTTY) throw new Error('piped numeric aggregate required');
  const pieces = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 256) throw new Error('aggregate too large');
    pieces.push(chunk);
  }
  if (bytes < 2) throw new Error('empty aggregate');
  const raw = new TextDecoder('utf-8', { fatal: true })
    .decode(Buffer.concat(pieces));
  return JSON.parse(raw);
}

function readConfig(args) {
  if (args.length !== 3) throw new Error('exact operator options required');
  const pairs = new Map();
  for (const arg of args) {
    const split = arg.indexOf('=');
    const name = arg.slice(0, split);
    if (split < 0 || ![
      '--directory', '--max-requests', '--max-budget-usd'
    ].includes(name) || pairs.has(name)) {
      throw new Error('invalid operator option');
    }
    pairs.set(name, arg.slice(split + 1));
  }
  const requests = pairs.get('--max-requests');
  const budget = pairs.get('--max-budget-usd');
  if (typeof pairs.get('--directory') !== 'string' ||
      !/^[1-9][0-9]{0,2}$/.test(requests ?? '') ||
      !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(budget ?? '')) {
    throw new Error('invalid operator capacity settings');
  }
  return {
    directory: pairs.get('--directory'),
    maxRequests: Number(requests),
    maxBudgetUsd: Number(budget)
  };
}

async function run() {
  // A deliberate local administrative invocation only, not an HTTP route or
  // production scheduling hook. Does not confer permission to alter staging.
  if (process.env.FAISCA_PRIVATE_OPERATOR_USAGE_REVIEW !== 'REVIEW_ONLY') {
    throw new Error('operator review not enabled');
  }
  const config = readConfig(process.argv.slice(2));
  const aggregate = await readAggregate();
  const ledger = createFaiscaLocalReservationLedger(config);
  const snapshot = await ledger.inspectReadOnly();
  const result = reviewFaiscaPrivateUsage(snapshot, aggregate);
  // JSON output is whitelisted by the strict comparator; it cannot contain
  // supplied identifiers, local paths, credential text or customer messages.
  process.stdout.write(JSON.stringify(result) + '\n');
}

run().catch(() => {
  // Never emit exception details, user input, filesystem paths or credentials.
  process.stderr.write('Private usage comparison unavailable; manual review required.\n');
  process.exitCode = 1;
});
