import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  checkNativeOnepageContract, gitBlobHash, verifyNativeOnepagePortalPin
} from '../ops/faisca/qualification/verify-native-portal-pin.mjs';
import { NATIVE_ONEPAGE_PORTAL_PIN } from '../ops/faisca/qualification/portal-native-intent.mjs';

const source = Object.freeze({
  controller: [
    "$this->only($input, ['request_key', 'selection'])",
    "$request->session()->get('portal.browser_auth')",
    "($state['phase'] ?? null) !== 'business'",
    "$this->orders->createDraft($reference, $input['request_key'], $input['selection'])"
  ].join('\n'),
  commands: [
    "$keys!==['channels','site','tier']",
    "$selection['site']!=='onepage'",
    "$selection['channels']!==[]",
    "!in_array($selection['tier'],['minimum','recommended'],true)"
  ].join('\n'),
  config: "'enabled' => env('PORTAL_ONEPAGE_ENABLED', false) === true",
  contract: [
    'A seleção aceita exclusivamente site=onepage, channels=[] e tier=minimum|recommended',
    'o navegador não fornece comprador ou empresa.'
  ].join('\n')
});

test('R36 pins the already reviewed native Portal contract without live credentials', () => {
  assert.match(NATIVE_ONEPAGE_PORTAL_PIN, /^[0-9a-f]{40}$/);
  assert.equal(checkNativeOnepageContract(source), true);
  const a = gitBlobHash(Buffer.from('hello\n'));
  const b = gitBlobHash(Buffer.from('hello changed\n'));
  assert.match(a, /^[a-f0-9]{40}$/);
  assert.notEqual(a, b);
  assert.throws(() => gitBlobHash('plain string'), TypeError);
});

test('R36 exact native contract gate rejects every missing authority or selection constraint', () => {
  for (const [key, search] of [
    ['controller', "['request_key', 'selection']"],
    ['controller', "'portal.browser_auth'"],
    ['controller', "!== 'business'"],
    ['controller', 'createDraft('],
    ['commands', "'channels','site','tier'"],
    ['commands', "['site']!=='onepage'"],
    ['commands', "['channels']!==[]"],
    ['commands', "'minimum','recommended'"],
    ['config', 'PORTAL_ONEPAGE_ENABLED'],
    ['contract', 'site=onepage'],
    ['contract', 'channels=[]'],
    ['contract', 'tier=minimum|recommended'],
    ['contract', 'o navegador não fornece comprador ou empresa.']
  ]) {
    assert.ok(source[key].includes(search), key + ': ' + search);
    const changed = { ...source, [key]: source[key].replace(search, 'REMOVED_FOR_TEST') };
    assert.equal(checkNativeOnepageContract(changed), false, key + ': ' + search);
  }
  assert.equal(checkNativeOnepageContract({}), false);
  assert.equal(checkNativeOnepageContract(null), false);
});

test('R36 refuses unpinned source bytes before any network or Portal operation', async t => {
  const root = await mkdtemp(join(tmpdir(), 'r36-native-portal-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = [
    'apps/portal/app/Http/Controllers/OnepageOrderController.php',
    'apps/portal/app/Infrastructure/Commerce/OnepageOrderCommands.php',
    'apps/portal/config/portal_onepage.php',
    'apps/portal/docs/NATIVE-ONEPAGE-CHECKOUT.md'
  ];
  for (const path of paths) {
    const name = join(root, path);
    await mkdir(dirname(name), { recursive: true });
    await writeFile(name, 'SYNTHETIC INCORRECT PORTAL CONTRACT ' + path);
  }
  await assert.rejects(verifyNativeOnepagePortalPin({ portalRoot: root }),
    /pinned Portal checkout source changed/);
  await assert.rejects(verifyNativeOnepagePortalPin({ portalRoot: null }), TypeError);
});
