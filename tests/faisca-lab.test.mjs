import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { publicFaiscaEnabled, labProfile, requireLabMode } from '../ops/faisca/lab/lab-policy.mjs';
import { renderLabView } from '../ops/faisca/lab/render-fragment.mjs';

test('laboratory requires explicit trusted build flag and never enables public operation', () => {
  assert.equal(publicFaiscaEnabled, false);
  assert.equal(requireLabMode('1'), labProfile);
  assert.ok(Object.isFrozen(labProfile));
  for (const value of [undefined, null, '', '0', true, 1, 'true']) assert.throws(() => requireLabMode(value), /laboratory only/);
  for (const key of ['publicEnabled', 'externalCalls', 'businessEffects', 'authenticatedPostSale']) assert.equal(labProfile[key], false);
});

test('Astro fragment reuses original asset and content without embedded executable bootstrap', async () => {
  const view = await renderLabView();
  assert.doesNotMatch(view.markup, /<script\b|__FAISCA_/i);
  assert.match(view.markup, /faisca-composer/);
  assert.match(view.markup, /Nenhum atendimento, pedido ou contato é enviado/);
  assert.match(view.css, /prefers-reduced-motion/);
  const original = await readFile(new URL('../ops/faisca/assets/faisca-master.png', import.meta.url));
  const embedded = view.markup.match(/src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(embedded);
  assert.deepEqual(Buffer.from(embedded[1], 'base64'), original);
  assert.equal(view.image_sha256, createHash('sha256').update(original).digest('hex'));
});
