import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectPrivateReviewAssetSizes, PRIVATE_REVIEW_ASSET_MAX_BYTES,
  PRIVATE_REVIEW_ASSET_SIZE_SCHEMA
} from '../ops/faisca/openai/private-asset-size-gate.mjs';

test('R213 strict private HTML/JS/CSS size gate passes reviewed real assets', () => {
  const review = inspectPrivateReviewAssetSizes();
  assert.equal(review.schema, PRIVATE_REVIEW_ASSET_SIZE_SCHEMA);
  assert.equal(review.status, 'PRIVATE_ASSET_SIZE_PREFLIGHT_PASSED');
  assert.equal(review.limitBytes, 24 * 1024);
  assert.equal(PRIVATE_REVIEW_ASSET_MAX_BYTES, 24 * 1024);
  assert.deepEqual(review.assets.map(asset => asset.asset), [
    'review.html', 'review-conversation.html', 'review.js', 'review.css'
  ]);
  for (const asset of review.assets) {
    assert.ok(asset.bytes > 0 && asset.bytes <= PRIVATE_REVIEW_ASSET_MAX_BYTES);
  }
  assert.equal(review.publicReady, false);
  assert.equal(review.modelInvocations, 0);
});

test('R213 fails closed on 24 KiB + 1 byte, not by raising an approved cap', () => {
  assert.doesNotThrow(() => inspectPrivateReviewAssetSizes([
    ['review.js', 'x'.repeat(PRIVATE_REVIEW_ASSET_MAX_BYTES)]
  ]));
  assert.throws(() => inspectPrivateReviewAssetSizes([
    ['review.js', 'x'.repeat(PRIVATE_REVIEW_ASSET_MAX_BYTES + 1)]
  ]), /R213: private asset review\.js exceeds the 24 KiB review limit/);
  assert.throws(() => inspectPrivateReviewAssetSizes([
    ['review.js', 'é'.repeat(PRIVATE_REVIEW_ASSET_MAX_BYTES / 2 + 1)]
  ]), /24 KiB review limit/, 'UTF-8 bytes, not JS string length');
  assert.throws(() => inspectPrivateReviewAssetSizes([]), /nonempty reviewed list/);
  assert.throws(() => inspectPrivateReviewAssetSizes([['review.js', null]]),
    /not a static text asset/);
});
