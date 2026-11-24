import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

for (const conversation of [false, true]) {
  test('R321 operator shutdown prevents dispatch of an admitted but incomplete ' +
    (conversation ? 'fictional conversation' : 'fixed case'), async () => {
    let calls = 0, ack = 0, uncertain = 0;
    const token = 'R321_SYNTHETIC_REVIEW_TOKEN_000000000';
    const lab = {
      inspect: () => ({ localDurableReservations: true }),
      answer: async () => { calls++; throw new Error('unexpected provider dispatch'); },
      answerPrivateConversation: async () => { calls++; throw new Error('unexpected provider dispatch'); },
      assertPrivateHttpDeliverySafe: async () => true,
      acknowledgeHttpDelivery: async () => { ack++; return true; },
      markDeliveryUncertain: async () => { uncertain++; return true; }
    };
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true, bodyTimeoutMs: 3000
    });
    const body = conversation
      ? JSON.stringify([true, 'Vale a pena usar uma landing page para divulgar um evento?'])
      : JSON.stringify({ caseId: 'compare' });
    const path = conversation ? '/__faisca_openai_private/converse' : '/__faisca_openai_private/respond';
    let req;
    try {
      let settled = false;
      const result = new Promise((resolve, reject) => {
        req = request(server.address + path, {
          agent: false, method: 'POST', headers: {
            Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body), Connection: 'close'
          }
        }, res => {
          let value = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { value += chunk; });
          res.on('error', reject);
          res.on('end', () => resolve({ status: res.statusCode, value: JSON.parse(value) }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('shutdown regression timed out')));
        req.write(body.slice(0, 1));
      });
      result.then(() => { settled = true; }, () => { settled = true; });
      // Let the loopback parser enter the body read while withholding its end.
      await delay(150);
      assert.equal(settled, false);
      assert.equal(calls, 0);
      const firstClose = server.close();
      const secondClose = server.close();
      assert.equal(server.inspect().active, false);
      assert.equal(firstClose, secondClose, 'concurrent close calls share the drain');
      req.end(body.slice(1));
      const response = await result;
      assert.deepEqual(response, { status: 503, value: { status: 'unavailable' } });
      await Promise.all([firstClose, secondClose]);
      assert.equal(server.inspect().requests, 0);
      assert.equal(calls, 0);
      assert.equal(ack, 0);
      assert.equal(uncertain, 0);
    } finally {
      req?.destroy();
      await server.close();
    }
  });
}
