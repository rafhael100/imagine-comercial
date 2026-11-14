import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const originalPortalBlob='678adeceb3a8ecdaeb6b576b9ee18d1bf0396f77';
const logo=readFileSync(new URL('../public/logo-imagine.png',import.meta.url));
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');

test('F240 original Imagine PNG is the exact preserved Portal Git blob',()=>{
  assert.equal(logo.length,5594);
  assert.deepEqual([...logo.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(gitBlobSha(logo),originalPortalBlob);
});
test('F240 shared layout renders accessible brand link with real local logo and warm tokens',()=>{
  const source=read('src/layouts/BaseLayout.astro');
  assert.match(source,/<a class="brand" href="\/" aria-label="Imagine Comunicação Digital — Página inicial"/);
  assert.match(source,/<img src="\/logo-imagine\.png" alt="" width="190"/);
  assert.match(source,/--imagine-orange: #f9941d/);
  assert.match(source,/--imagine-ink: #171b19/);
  assert.match(source,/<meta name="theme-color" content="#171b19"/);
  assert.doesNotMatch(source,/\bimagine\.<\/a>/);
});
test('F240 decorative hero and contact shell use orange accents, not blue primary CTA',()=>{
  const hero=read('src/components/HeroVisual.astro');
  const contact=read('src/pages/contato.astro');
  const index=read('src/pages/index.astro');
  assert.match(hero,/\.preview-button\{background:#f9941d;color:#171b19/);
  assert.match(index,/#884100/);
  assert.match(contact,/#fff8ed/);
  assert.doesNotMatch(hero,/\.preview-button\{background:#176ebd/);
});
