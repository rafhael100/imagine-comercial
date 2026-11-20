import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

// Execute the exact browser script up to event-listener registration. This
// exercises the real reader/abort implementation, not a rewritten test helper.
function getBrowserReader() {
  const marker = 'form?.addEventListener';
  assert.equal(PRIVATE_REVIEW_JS.split(marker).length, 2);
  const context = {
    document: { getElementById: () => null },
    TextDecoder, Uint8Array, Promise, Error
  };
  runInNewContext(
    PRIVATE_REVIEW_JS.split(marker)[0] +
      '\n;globalThis.testReadBoundedPrivateJson = readBoundedPrivateJson;',
    context
  );
  return context.testReadBoundedPrivateJson;
}

function mockedResponse(reader, length = null) {
  return {
    headers: { get: name => name === 'content-length' ? length : null },
    body: { getReader: () => reader }
  };
}

async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('R109 reader did not settle')), 500);
      })
    ]);
  } finally { clearTimeout(timer); }
}

test('R109 stalled browser stream read aborts even when reader ignores signal and cancel hangs', async () => {
  const read = getBrowserReader();
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  let cancels = 0;
  const reader = {
    read() { started(); return new Promise(() => {}); },
    cancel() { cancels++; return new Promise(() => {}); }
  };
  const controller = new AbortController();
  const request = read(mockedResponse(reader), controller.signal);
  await bounded(entered);
  controller.abort();
  await assert.rejects(bounded(request), /private_response_timeout/);
  assert.equal(cancels, 1, 'cleanup is attempted but never awaited');
});

test('R109 valid bounded JSON returns even when reader cancellation ignores completion', async () => {
  const read = getBrowserReader();
  const json = new TextEncoder().encode('{"status":"synthetic_ok"}');
  let next = 0, cancels = 0;
  const reader = {
    read() {
      next++;
      return Promise.resolve(next === 1
        ? { done: false, value: json }
        : { done: true });
    },
    cancel() { cancels++; return new Promise(() => {}); }
  };
  const parsed = await bounded(read(
    mockedResponse(reader, String(json.byteLength)), new AbortController().signal
  ));
  assert.equal(parsed.status, 'synthetic_ok');
  assert.equal(next, 2);
  assert.equal(cancels, 1);
});

test('R109 oversized response rejects before consuming any stream bytes', async () => {
  const read = getBrowserReader();
  let reads = 0;
  const reader = {
    read() { reads++; throw new Error('must not consume oversized response'); },
    cancel() { throw new Error('must not cancel unopened reader'); }
  };
  await assert.rejects(
    bounded(read(mockedResponse(reader, '16385'), new AbortController().signal)),
    /private_response_too_large/
  );
  assert.equal(reads, 0);
});
