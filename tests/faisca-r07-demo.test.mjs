import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runSampleJourney, SAMPLE_STEPS } from '../ops/faisca/journey/demo.mjs';

test('R07 offline transcript keeps only the last confirmed goal in the final summary', () => {
  const result = runSampleJourney();
  assert.equal(result.steps.length, SAMPLE_STEPS.length);
  assert.equal(result.steps[0].intent, 'journey_confirmation_needed');
  assert.equal(result.steps[1].intent, 'goal_presence');
  assert.equal(result.steps[2].intent, 'grounding_unsupported');
  assert.equal(result.steps[3].intent, 'journey_confirmation_needed');
  assert.equal(result.steps[4].intent, 'goal_campaign');
  assert.equal(result.steps[5].intent, 'process');
  assert.ok(result.steps[5].sources.length >= 1);
  assert.match(result.summary, /Landing Page/);
  assert.doesNotMatch(result.summary, /Site Onepage/);
  assert.match(result.summary, /não foi enviado à equipe/i);
  assert.equal(result.externalModelInvocations, 0);
  assert.equal(result.deliveredToImagine, false);
});

test('R07 CLI demonstration runs with Node and produces no false delivery claim', () => {
  const path = fileURLToPath(new URL('../ops/faisca/journey/demo.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [path], { encoding: 'utf8', timeout: 5000 });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /RESUMO FINAL/);
  assert.match(child.stdout, /Landing Page/);
  assert.match(child.stdout, /Nenhum contato foi enviado/);
  assert.equal(child.stderr, '');
});
