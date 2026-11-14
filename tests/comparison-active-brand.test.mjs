import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/comparar-solucoes.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');

function luminance(hex){
  const rgb=hex.slice(1).match(/.{2}/g).map(part=>{
    const value=parseInt(part,16)/255;
    return value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;
  });
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
}

test('F289 active compare buttons use original Imagine palette with AA contrast',()=>{
  assert.match(layout,/--imagine-orange: #f9941d/);
  assert.match(layout,/--imagine-ink: #171b19/);
  assert.match(page,/\.compare-selector\[aria-pressed="true"\]\{color:var\(--imagine-ink\);background:var\(--imagine-orange\)/);
  assert.doesNotMatch(page,/#14583d|#e6f5ec|#287c5b/);
  const light=luminance('#f9941d'),dark=luminance('#171b19');
  assert.ok((light+0.05)/(dark+0.05)>=4.5);
});

test('F289 Chromium mobile and desktop assert computed colors',()=>{
  assert.match(browser,/F289 active service control preserves Imagine identity/);
  assert.match(browser,/background:'rgb\(249, 148, 29\)'/);
  assert.match(browser,/color:'rgb\(23, 27, 25\)'/);
  assert.match(page,/aria-pressed="false"/);
});
