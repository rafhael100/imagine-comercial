import { createHash } from 'node:crypto';
import { realpath, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NATIVE_ONEPAGE_PORTAL_PIN } from './portal-native-intent.mjs';

export const ONEPAGE_SOURCE_PROOF_SCHEMA = 'faisca.native-onepage-portal-source-proof.v1';
const sourceFiles = Object.freeze({
  controller: Object.freeze({
    path: 'apps/portal/app/Http/Controllers/OnepageOrderController.php',
    gitBlob: '1c63f3c56cb486f139cdd19028af70c36a0c09b1'
  }),
  commands: Object.freeze({
    path: 'apps/portal/app/Infrastructure/Commerce/OnepageOrderCommands.php',
    gitBlob: '779d395699915907903c96fa71e3dbd40bfa0a75'
  }),
  config: Object.freeze({
    path: 'apps/portal/config/portal_onepage.php',
    gitBlob: 'ba923b10ed8f5b7e3959591c594d63c795a26e87'
  }),
  contract: Object.freeze({
    path: 'apps/portal/docs/NATIVE-ONEPAGE-CHECKOUT.md',
    gitBlob: '138f494281beb6ce2dc7402f916d68cff3177a77'
  })
});

/** Git blob identity is a source-version check, not a security signature. */
export function gitBlobHash(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('R36: Git blob bytes required.');
  const hasher = createHash('sha1');
  hasher.update('blob ' + bytes.length + '\0');
  hasher.update(bytes);
  return hasher.digest('hex');
}

/** Conservative checks for the native buyer/session and selection limits
 * assumed by the Faísca R34 intent.
 */
export function checkNativeOnepageContract({ controller, commands, config, contract } = {}) {
  if (![controller, commands, config, contract].every(s => typeof s === 'string')) return false;
  return (
    controller.includes("$this->only($input, ['request_key', 'selection'])") &&
    controller.includes("$request->session()->get('portal.browser_auth')") &&
    controller.includes("($state['phase'] ?? null) !== 'business'") &&
    controller.includes("$this->orders->createDraft($reference, $input['request_key'], $input['selection'])") &&
    commands.includes("$keys!==['channels','site','tier']") &&
    commands.includes("$selection['site']!=='onepage'") &&
    commands.includes("$selection['channels']!==[]") &&
    commands.includes("!in_array($selection['tier'],['minimum','recommended'],true)") &&
    config.includes("'enabled' => env('PORTAL_ONEPAGE_ENABLED', false) === true") &&
    contract.includes('A seleção aceita exclusivamente') &&
    contract.includes('site=onepage') &&
    contract.includes('channels=[]') &&
    contract.includes('tier=minimum|recommended') &&
    contract.includes('o navegador não fornece comprador ou empresa.')
  );
}

/** Verify immutable Portal checkout source from a READ-ONLY CI checkout.
 * No HTTP call, secret or request to the real Portal is performed.
 */
export async function verifyNativeOnepagePortalPin({ portalRoot } = {}) {
  if (typeof portalRoot !== 'string' || portalRoot.length > 1024 ||
      !/^[0-9a-f]{40}$/.test(NATIVE_ONEPAGE_PORTAL_PIN)) {
    throw new TypeError('R36: immutable Portal checkout root and pinned SHA required.');
  }
  const root = resolve(portalRoot);
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) {
    throw new Error('R36: only a real Portal source directory is allowed.');
  }
  const source = {};
  for (const [key, file] of Object.entries(sourceFiles)) {
    const path = resolve(root, file.path);
    if (!path.startsWith(root + sep) || !(await realpath(path)).startsWith(root + sep) ||
        !(await lstat(path)).isFile()) {
      throw new Error('R36: the pinned Portal checkout includes an unsafe path.');
    }
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size < 40 || stat.size > 16000) {
        throw new Error('R36: unexpected Portal contract file size.');
      }
      bytes = await handle.readFile();
      if (bytes.length !== stat.size) throw new Error('R36: Portal contract changed during review.');
    } finally { await handle.close(); }
    if (gitBlobHash(bytes) !== file.gitBlob) {
      throw new Error('R36: pinned Portal checkout source changed (' + key + ').');
    }
    source[key] = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  if (!checkNativeOnepageContract(source)) {
    throw new Error('R36: Portal Onepage authority or selection assumptions changed.');
  }
  return Object.freeze({
    schema: ONEPAGE_SOURCE_PROOF_SCHEMA,
    portalSha: NATIVE_ONEPAGE_PORTAL_PIN,
    checkedFiles: Object.keys(sourceFiles).length,
    nativeOnepageOnly: true,
    publicCheckoutAuthorized: false,
    requestCreated: false,
    operationalEffects: false
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 4 || process.argv[2] !== '--portal-root') {
    throw new Error('Usage: node verify-native-portal-pin.mjs --portal-root <pinned-checkout>');
  }
  const result = await verifyNativeOnepagePortalPin({ portalRoot: process.argv[3] });
  process.stdout.write(JSON.stringify(result) + '\n');
}
