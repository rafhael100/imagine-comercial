import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { preparePinnedProcessBridge } from '../agents/php-provider.mjs';
import { CATALOG, CATALOG_JSON, CATALOG_SHA256 } from './catalog.mjs';
import { GROUNDED_ENTRYPOINT, GROUNDED_CATALOG_PATH, GROUNDED_REQUIRED_FILES,
  createGroundedRequest, parseGroundedOutput, finishGroundedResponse } from './protocol.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const sourcePaths = Object.freeze(['src/data/services.mjs', 'src/data/commercial-faq.mjs', 'src/data/commercial-process.mjs']);
const localCatalog = fileURLToPath(new URL('./catalog.json', import.meta.url));

async function verifyGroundingFiles({ pin, readPinnedFile }) {
  if (pin.files[GROUNDED_CATALOG_PATH] !== CATALOG_SHA256 || sha256(CATALOG_JSON) !== CATALOG_SHA256 ||
      sha256(await readPinnedFile(localCatalog, 64 * 1024)) !== CATALOG_SHA256 ||
      JSON.stringify(Object.keys(CATALOG.sourceSnapshot.files).sort()) !== JSON.stringify([...sourcePaths].sort())) {
    throw new Error('Grounding source mismatch.');
  }
  for (const path of sourcePaths) {
    const local = fileURLToPath(new URL('../../../' + path, import.meta.url));
    if (sha256(await readPinnedFile(local, 1024 * 1024)) !== CATALOG.sourceSnapshot.files[path]) {
      throw new Error('Grounding source mismatch.');
    }
  }
}

const groundedContract = Object.freeze({ entrypoint: GROUNDED_ENTRYPOINT, requiredFiles: GROUNDED_REQUIRED_FILES,
  scenarios: Object.freeze(['success', 'delay', 'unavailable', 'malformed', 'exit_after_dispatch',
    'revoke_before_delivery', 'source_disabled_before_delivery']),
  environment: Object.freeze({ IMAGINE_FAISCA_GROUNDED_LAB: '1' }),
  createRequest: createGroundedRequest, parseOutput: parseGroundedOutput,
  finish: finishGroundedResponse, verifyExtra: verifyGroundingFiles });

/** Trusted host entrypoint; request fields cannot select contracts or source files. */
export function prepareGroundedBridge(options = {}) {
  return preparePinnedProcessBridge(options, groundedContract);
}
