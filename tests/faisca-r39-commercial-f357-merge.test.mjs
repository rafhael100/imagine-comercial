import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { publicFaiscaEnabled } from '../ops/faisca/lab/lab-policy.mjs';
import { reviewedQuoteChoiceHref } from '../src/data/reviewed-quote-choice-href.mjs';
import { reviewedQuoteChoiceMessage } from '../src/data/reviewed-quote-choice-messages.mjs';
import { contactWhatsAppUrl } from '../src/data/contact-channels.mjs';
import { buildNativeOnepagePortalIntent } from '../ops/faisca/qualification/portal-native-intent.mjs';

const repoRoot = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(
  new URL('../ops/faisca/integration/f357-merge-manifest.json', import.meta.url),'utf8'
));
const gitBlob = bytes => createHash('sha1')
  .update('blob ' + bytes.length + '\0').update(bytes).digest('hex');

test('R39 source merge has 33 reviewed blobs from F357, including all conflict resolutions', async () => {
  assert.equal(manifest.schema,'faisca.commercial-f357-integrated-source.v1');
  assert.equal(manifest.commonAncestor,'a4f4eb9687b6dfd9c0d45e88e8345cc37198cd6e');
  assert.equal(manifest.commercialHead,'3adc79ff6ea78f1d4a629101ce85cf7cc1bedbd2');
  assert.equal(manifest.faiscaR38Head,'0c7fa2297f1566c86f0b97eaf6d8a877adae5a10');
  assert.equal(manifest.mergeCommit,'9ad6b95fe81b2f51453f70af897ece7a2979ff4a');
  assert.equal(manifest.expectedChangeCount,33);
  assert.equal(manifest.files.length,33);
  assert.deepEqual(manifest.counts,{
    imported_unmodified:29,already_identical:1,reviewed_commercial_conflict:3
  });
  const paths=new Set();
  const count={ imported_unmodified:0, already_identical:0, reviewed_commercial_conflict:0 };
  for(const item of manifest.files) {
    assert.deepEqual(Object.keys(item).sort(), ['path','resolution','sha']);
    assert.match(item.path,/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/);
    assert.ok(!item.path.split('/').some(part=>part==='.'||part==='..'));
    assert.equal(paths.has(item.path),false,'No repeated imported files');
    paths.add(item.path);
    assert.match(item.sha,/^[a-f0-9]{40}$/);
    assert.ok(Object.hasOwn(count,item.resolution));
    count[item.resolution]++;
    const bytes=await readFile(new URL(item.path,repoRoot));
    assert.equal(gitBlob(bytes),item.sha,'The exact reviewed F357 source must be preserved: '+item.path);
  }
  assert.deepEqual(count,manifest.counts);
  assert.deepEqual(
    manifest.files.filter(x=>x.resolution==='reviewed_commercial_conflict').map(x=>x.path),
    ['scripts/browser-qa.mjs','src/components/CommercialChoicePreview.astro',
      'tests/reviewed-quote-contact.test.mjs']
  );
});

test('R39 preserves privacy and release no-go when merging the Commercial development lineage', async () => {
  assert.equal(publicFaiscaEnabled,false);
  assert.deepEqual(manifest.policy,{
    releaseAuthorized:false,productionPublished:false,
    externalModelEnabled:false,operationalEffects:false
  });
  const approved = await readFile(new URL('../ops/faisca/assets/faisca-master.png', import.meta.url));
  const sha=createHash('sha256').update(approved).digest('hex');
  assert.equal(sha,'1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d');
  assert.equal(buildNativeOnepagePortalIntent(null),null);
});

test('R39 reviewed quote links use one vetted WhatsApp source in all three locales', () => {
  const options={
    site:'onepage',channels:['google_ads','chatgpt_ads'],tier:'recommended'
  };
  for(const locale of ['pt-BR','en','es']){
    const message=reviewedQuoteChoiceMessage(locale,options);
    const href=reviewedQuoteChoiceHref(locale,options);
    assert.equal(href,contactWhatsAppUrl(message));
    assert.deepEqual([...new URL(href).searchParams.keys()],['text']);
  }
});

test('R39 imported quote guard and private Faísca handoff remain distinct', async () => {
  const [quote,server,bridge]=await Promise.all([
    readFile(new URL('../src/components/CommercialChoicePreview.astro',import.meta.url),'utf8'),
    readFile(new URL('../src/lib/private-loopback-preview.mjs',import.meta.url),'utf8'),
    readFile(new URL('../ops/faisca/composition/quote-bridge.mjs',import.meta.url),'utf8')
  ]);
  assert.match(quote,/getAttribute\('aria-disabled'\)==='true'\)event\.preventDefault\(\)/);
  assert.match(quote,/\[data-choice-action\]/);
  assert.match(server,/data-faisca-private-entry/);
  assert.match(server,/data-faisca-apply-choice/);
  assert.match(bridge,/data-faisca-quote-site/);
  assert.match(bridge,/Object\.hasOwn\(allowed,\s*value\)/);
  assert.doesNotMatch(bridge,/\bfetch\s*\(|XMLHttpRequest|postMessage|localStorage|sessionStorage/);
});
