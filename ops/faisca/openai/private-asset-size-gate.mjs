import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML,
  PRIVATE_REVIEW_JS, PRIVATE_REVIEW_CSS
} from './private-review-page.mjs';

// Must remain aligned with the INDEPENDENT HTTP read-only smoke budget.
// This gate runs first to avoid obscuring one oversized asset under dozens
// of downstream exact-byte staging failures. Never increase the limit here
// to make CI green; reduce the asset or obtain an independent review.
export const PRIVATE_REVIEW_ASSET_MAX_BYTES = 24 * 1024;
export const PRIVATE_REVIEW_ASSET_SIZE_SCHEMA = 'faisca.private-asset-size-preflight.v1';

const approvedAssets = Object.freeze([
  Object.freeze(['review.html', PRIVATE_REVIEW_HTML]),
  Object.freeze(['review-conversation.html', PRIVATE_REVIEW_CONVERSATION_HTML]),
  Object.freeze(['review.js', PRIVATE_REVIEW_JS]),
  Object.freeze(['review.css', PRIVATE_REVIEW_CSS])
]);

/** Pure, offline fast-fail; never fetches assets, starts a server or calls AI. */
export function inspectPrivateReviewAssetSizes(assets = approvedAssets) {
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new TypeError('Private asset size preflight requires a nonempty reviewed list.');
  }
  const checked = [];
  for (const pair of assets) {
    if (!Array.isArray(pair) || pair.length !== 2 ||
        typeof pair[0] !== 'string' || !/^[a-z][a-z.-]{1,40}$/.test(pair[0]) ||
        typeof pair[1] !== 'string') {
      throw new TypeError('Private asset preflight input is not a static text asset.');
    }
    const bytes = Buffer.byteLength(pair[1], 'utf8');
    if (bytes > PRIVATE_REVIEW_ASSET_MAX_BYTES) {
      throw new Error('R213: private asset ' + pair[0] + ' exceeds the 24 KiB review limit (' +
        bytes + ' bytes). Do not relax the limit; review the added source.');
    }
    checked.push(Object.freeze({ asset: pair[0], bytes }));
  }
  return Object.freeze({
    schema: PRIVATE_REVIEW_ASSET_SIZE_SCHEMA,
    status: 'PRIVATE_ASSET_SIZE_PREFLIGHT_PASSED',
    limitBytes: PRIVATE_REVIEW_ASSET_MAX_BYTES,
    assets: Object.freeze(checked),
    publicReady: false,
    modelInvocations: 0
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
    throw new Error('Usage: node ops/faisca/openai/private-asset-size-gate.mjs --verify');
  }
  process.stdout.write(JSON.stringify(inspectPrivateReviewAssetSizes()) + '\n');
}
