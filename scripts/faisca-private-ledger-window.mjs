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
  const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
  const payload = JSON.parse(raw);
  // JSON.parse silently accepts duplicate keys. The input consists only of
  // R348's ASCII schema/status, booleans and bounded integers, so require
  // JSON.stringify's unambiguous representation, allowing formatting space
  // outside strings. Do not echo rejected input or try to repair evidence.
  const compact = raw.replace(/"(?:[^"\\]|\\.)*"|[ \t\r\n]+/gs,
    token => token[0] === '"' ? token : '');
  if (JSON.stringify(payload) !== compact) throw new Error('blocked');
  if (!Array.isArray(payload) || payload.length !== 2) throw new Error('blocked');
  const report = compareFaiscaPrivateLedgerWindow(payload[0], payload[1], Number(expected));
  console.log(JSON.stringify(report, null, 2));
  if (!report.localDeltaVerified) process.exitCode = 1;
}
try { await main(); } catch {
  console.error('PRIVATE_LOCAL_WINDOW_BLOCKED: two bounded local observations and explicit acknowledgement required.');
  process.exitCode = 2;
}
