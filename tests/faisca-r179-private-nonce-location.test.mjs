import test from 'node:test';
import assert from 'node:assert/strict';
import { join, sep } from 'node:path';
import { hasFaiscaSeparatedIndependentNonceDirectory as separated } from
  '../ops/faisca/openai/private-operator-nonce-location.mjs';

const base = join(sep, 'private', 'faisca');
const checkout = join(base, 'checkout');
const evidence = join(base, 'evidence');
const directory = join(base, 'nonce-registry');

test('R179 permits only a separately configured canonical private registry', () => {
  assert.equal(separated({ checkout, evidence, directory }), true);
  // A prefix match is not enough to establish nesting.
  assert.equal(separated({ checkout, evidence, directory: evidence + '-sibling' }), true);
  for (const bad of [
    checkout, evidence, base,
    join(checkout, 'registry'), join(evidence, 'registry'),
    join(checkout, 'nested', 'registry'),
    join(evidence, 'nested', 'registry'),
    sep
  ]) assert.equal(separated({ checkout, evidence, directory: bad }), false);
});

test('R179 rejects wrong types, relative paths, path traversal and empty evidence', () => {
  for (const args of [
    { checkout, evidence, directory: '../nonce' },
    { checkout, evidence, directory: directory + '/../other' },
    { checkout, evidence: '', directory },
    { checkout, evidence: null, directory },
    { checkout, evidence, directory: null },
    { checkout: '.', evidence, directory },
    { checkout, evidence, directory: directory + '\0marker' },
    { checkout, evidence, directory: directory + '/.' },
    { checkout, evidence, directory: 123 }
  ]) assert.equal(separated(args), false);
});
