import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/pages/como-funciona.astro',import.meta.url),'utf8');
const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

function luminance(color){
  const c=color.slice(1).match(/.{2}/g).map(x=>{
    const n=parseInt(x,16)/255;
    return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
  });
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}

test('F298 checked preparation controls preserve original Imagine contrast and color',()=>{
  assert.match(layout,/--imagine-orange: #f9941d/);
  assert.match(layout,/--imagine-ink: #171b19/);
  assert.match(page,/\.briefing-toggle\[aria-pressed="true"\]\{background:var\(--imagine-orange\);border-color:#c3730f;color:var\(--imagine-ink\)\}/);
  assert.match(page,/\.briefing-task\[data-prepared="true"\]>span\{font-weight:700;color:var\(--imagine-ink\)\}/);
  assert.doesNotMatch(page,/#e6f5ee|#258567|#165b45|#145d53/);
  assert.ok((luminance('#f9941d')+0.05)/(luminance('#171b19')+0.05)>=4.5);
});

test('F298 browser validates pressed-state computed color and accessibility',()=>{
  assert.match(page,/aria-pressed="false"/);
  assert.match(page,/\.briefing-toggle:focus-visible\{outline:3px solid #b45b00/);
  assert.match(browser,/F298 prepared checklist action retains Imagine palette/);
  assert.match(browser,/background:'rgb\(249, 148, 29\)'/);
  assert.match(browser,/color:'rgb\(23, 27, 25\)'/);
});
