import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTER_DEMO_INPUTS, runModelRouterDemo } from '../ops/faisca/model-router/demo.mjs';

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
