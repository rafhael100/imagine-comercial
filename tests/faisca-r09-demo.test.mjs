import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTER_DEMO_INPUTS, runModelRouterDemo, FIELD_ROUTER_DEMO_INPUTS, runFieldRouterDemo } from '../ops/faisca/model-router/demo.mjs';

test('R09 demo is deterministic, offline and returns only catalog answers or fixed fallback', () => {
  const first = runModelRouterDemo();
  const second = runModelRouterDemo();
  assert.equal(first.length, ROUTER_DEMO_INPUTS.length);
  assert.deepEqual(first, second);
  assert.equal(first[0].answerId, 'goal_presence');
  assert.equal(first[1].answerId, 'pricing');
  assert.equal(first[2].answerId, 'process');
  assert.equal(first[3].answerId, 'compare_sites');
  assert.equal(first[4].answerId, 'channel_meta');
  assert.equal(first[5].routeStatus, 'unsupported');
  assert.ok(first.every(item => item.accepted));
  assert.ok(first.every(item => item.provenance === 'r06_verified_editorial' ||
    item.provenance === 'host_fixed_fallback'));
  assert.ok(first.every(item => !/apiKey|crm\.write|payment|password/i.test(item.text)));
});

test('R09 field demo is deterministic and never invents an answer for ambiguous consent or audience', () => {
  const first = runFieldRouterDemo();
  const second = runFieldRouterDemo();
  assert.equal(first.length, FIELD_ROUTER_DEMO_INPUTS.length);
  assert.deepEqual(first, second);
  assert.equal(first[0].status, 'matched');
  assert.equal(first[0].value, 'capture_leads');
  assert.equal(first[1].status, 'ambiguous');
  assert.equal(first[1].value, null);
  assert.equal(first[2].value, 'ready');
  assert.equal(first[3].value, 'within_30_days');
  assert.equal(first[4].value, 'declined');
  assert.ok(first.every(item => item.accepted));
});
