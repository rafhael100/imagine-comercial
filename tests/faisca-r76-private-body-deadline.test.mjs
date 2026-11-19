import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R76_BODY_DEADLINE_PRIVATE_TOKEN_123456789';
const validBody = '{"caseId":"compare"}';
function syntheticLab() {
  let calls = 0;
  return {
    answer: async () => {
      calls++;
      return {
        status: 'draft_answer',
        text: 'Resposta editorial fictícia, somente para revisão privada.',
        sourceIds: ['faisca.passage.fixture@r06-1'],
        modelIds: []
      };
    },
    inspect: () => ({ calls, durableBillingLimit: false })
  };
}

function incompletePost(server) {
  const { port } = new URL(server.address);
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port: Number(port) });
    let response = '', settled = false;
    const watchdog = setTimeout(() => finish(new Error('Private HTTP body stalled indefinitely')), 3000);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      socket.destroy();
      if (error) reject(error);
      else resolve(response);
    }
    socket.on('connect', () => {
      socket.write(
        'POST ' + server.path + ' HTTP/1.1\r\n' +
        'Host: 127.0.0.1:' + port + '\r\n' +
        'Authorization: Bearer ' + token + '\r\n' +
        'Content-Type: application/json\r\n' +
        'Content-Length: ' + (Buffer.byteLength(validBody) + 5) + '\r\n' +
        'Connection: close\r\n\r\n' + validBody
      );
      // Deliberately never send the final five bytes.
    });
    socket.on('data', chunk => { response += chunk.toString('utf8'); });
    socket.on('end', () => finish());
    socket.on('close', () => finish(response ? null : new Error('No HTTP response received')));
    socket.on('error', error => finish(error));
  });
}

test('R76 private HTTP rejects unsafe body deadline settings', async () => {
  const lab = syntheticLab();
  for (const bodyTimeoutMs of [0, 49, 30001, -1, 2.5, '150']) {
    await assert.rejects(startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, bodyTimeoutMs
    }), TypeError);
  }
});

test('R76 partial Content-Length times out without provider or socket leak', { timeout: 7000 }, async t => {
  const lab = syntheticLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, bodyTimeoutMs: 175
  });
  t.after(() => server.close());
  const timeoutResponse = await incompletePost(server);
  assert.match(timeoutResponse, /^HTTP\/1\.1 408 Request Timeout\r\n/);
  assert.match(timeoutResponse, /connection: close/i);
  const body = timeoutResponse.split('\r\n\r\n')[1];
  assert.deepEqual(JSON.parse(body), { status: 'request_timeout' });
  assert.equal(lab.inspect().calls, 0);

  const accepted = await fetch(server.address + server.path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: validBody
  });
  assert.equal(accepted.status, 200, 'After timeout, a valid private request still works.');
  assert.equal((await accepted.json()).publicReady, false);
  assert.equal(lab.inspect().calls, 1);
});
