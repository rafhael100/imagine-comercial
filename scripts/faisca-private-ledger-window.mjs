import { compareFaiscaPrivateLedgerWindow } from '../ops/faisca/openai/private-ledger-window.mjs';

async function main() {
  const expected = process.argv[2];
  if (process.argv.length !== 3 || !['2','4'].includes(expected) ||
      Object.hasOwn(process.env,'OPENAI_API_KEY') ||
      Object.hasOwn(process.env,'FAISCA_REVIEW_BEARER_TOKEN') ||
      process.env.FAISCA_PRIVATE_LEDGER_AUDIT_ACK !== 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF' ||
      process.stdin.isTTY) throw new Error('blocked');
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 4096) throw new Error('blocked');
    chunks.push(chunk);
  }
  const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  if (!Array.isArray(payload) || payload.length !== 2) throw new Error('blocked');
  const report = compareFaiscaPrivateLedgerWindow(payload[0], payload[1], Number(expected));
  console.log(JSON.stringify(report, null, 2));
  if (!report.localDeltaVerified) process.exitCode = 1;
}
try { await main(); } catch {
  console.error('PRIVATE_LOCAL_WINDOW_BLOCKED: two bounded local observations and explicit acknowledgement required.');
  process.exitCode = 2;
}
