import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');

test('F259 public header links have a 44px target without enlarging unrelated navigation',()=>{
  assert.match(css,/\.header > nav\[aria-label="Navegação principal"\] > a \{ display: inline-flex; align-items: center; min-height: 44px; \}/);
  assert.match(css,/\.brand \{[^}]*min-height: 52px;/);
  assert.match(css,/\.nav-help > summary \{[^}]*min-height: 44px;/);
  assert.match(css,/\.mobile-menu summary \{[^}]*min-height: 48px;/);
  assert.match(css,/\.mobile-nav a \{[^}]*min-height: 44px;/);
});

test('F259 footer navigation and contact links remain readable 44px targets',()=>{
  assert.match(css,/\.footer-links a, \.footer-contact a \{[^}]*min-height: 44px;/);
  assert.match(css,/:focus-visible \{ outline: 3px solid #b45b00;/);
  assert.match(css,/@media \(max-width: 1020px\)/);
  assert.match(css,/\.header > nav\[aria-label="Navegação principal"\] \{ display: none; \}/);
});
