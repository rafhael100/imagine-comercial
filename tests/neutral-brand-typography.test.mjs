import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
const contrastOnWhite = hex => {
  const channels=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255)
    .map(channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4);
  const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  return 1.05/(luminance+.05);
};

test('F260 shared copy uses neutral Imagine ink, not previous blue palette',()=>{
  assert.match(layout,/--imagine-ink: #171b19/);
  assert.match(layout,/\.skip-link \{[^}]*color: var\(--imagine-ink\)/);
  assert.match(layout,/\.lead \{[^}]*color: #514c43/);
  assert.match(layout,/\.card p \{ color: #514c43; \}/);
  assert.match(layout,/details p \{ color: #514c43; \}/);
  assert.match(layout,/details \{ border-bottom: 1px solid #e3ded6;/);
  assert.match(home,/\.hero-support\{font-size:\.87rem;color:#56534e;/);
  for(const obsolete of ['#152944','#4b5c74','#526178','#d5deea'])
    assert.equal(layout.includes(obsolete),false,'old blue text/border '+obsolete);
  assert.equal(home.includes('#4f617c'),false,'old blue hero support');
  for(const obsolete of ['#3c516c','#263d56','#182438','#536680'])
    assert.equal(contact.includes(obsolete),false,'old blue contact color '+obsolete);
  for(const selected of ['#56534e','#514c43','#171b19','#625c54'])
    assert.ok(contact.includes(selected),'approved neutral contact color '+selected);
});

test('F260 accessible neutral copy meets WCAG AA for text on white',()=>{
  for(const color of ['#514c43','#56534e','#171b19'])
    assert.ok(contrastOnWhite(color)>=4.5,'normal-text contrast '+color);
  assert.match(layout,/:focus-visible \{ outline: 3px solid #b45b00/);
});
