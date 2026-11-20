import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';

// R86: intentionally read-only. A SHA copied independently from the reviewed
// GitHub PR must be supplied; do not derive it from the local checkout itself.
// No secrets, paths or environment values are printed.
if (process.argv.length !== 3 || !/^[0-9a-f]{40}$/.test(process.argv[2])) {
  console.error('Uso: node scripts/faisca-private-staging-preflight.mjs <SHA-completo-da-PR-revisada>');
  process.exitCode = 2;
} else {
  const result = await inspectFaiscaPrivateStaging({ expectedHead: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'READY_FOR_PRIVATE_OPERATOR_START') process.exitCode = 1;
}
