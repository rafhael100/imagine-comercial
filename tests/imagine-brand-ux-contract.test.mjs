import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const layout=read('src/layouts/BaseLayout.astro');
const homepage=read('src/pages/index.astro');
const visual=read('src/components/HeroVisual.astro');
const logo=readFileSync(new URL('public/assets/logo-imagine.png',root));

test('A marca oficial do Portal Node é o mesmo PNG original, sem redesenho',()=>{
  const gitBlobSha=createHash('sha1').update('blob '+logo.length).update(Buffer.from([0])).update(logo).digest('hex');
  assert.equal(gitBlobSha,'678adeceb3a8ecdaeb6b576b9ee18d1bf0396f77');
  assert.match(layout,/<img src="\/assets\/logo-imagine\.png" alt="Imagine Comunicação Digital"/);
  assert.match(visual,/<img src="\/assets\/logo-imagine\.png" alt=""/);
});
test('A navegação compartilhada preserva identidade laranja e leitura clara',()=>{
  for(const t of ['--imagine-orange: #f9941d','--imagine-ink: #171b19','--imagine-surface: #f7f7f8','--imagine-orange-soft: #fff1e0'])assert.ok(layout.includes(t),t);
  assert.match(layout,/\.cta \{[^}]*background: var\(--imagine-orange\); color: var\(--imagine-ink\)/);
  assert.match(layout,/<details class="mobile-menu">/);
  assert.match(layout,/\.mobile-nav a\[aria-current="page"\]/);
  assert.match(layout,/:focus-visible \{ outline: 3px solid #b75c00;/);
  assert.match(homepage,/color:#9b4d00/);
  assert.match(visual,/#f9941d/);
  assert.doesNotMatch(layout,/@import|fonts\.googleapis/);
});
