import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const pin = 'a'.repeat(40);
const token = 'R92_PRIVATE_COMPOSITION_SYNTHETIC_TOKEN_12345';

test('R92 staging integrity gate, static browser smoke and R87 editorial response coexist without live API', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r92-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const preflight = await inspectFaiscaPrivateStaging({
    expectedHead: pin,
    env: {
      OPENAI_API_KEY: 'sk-R92_FAKE_ONLY_DO_NOT_USE_WITH_API',
      FAISCA_REVIEW_BEARER_TOKEN: token,
      FAISCA_PRIVATE_LEDGER_DIR: directory,
      IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'YES_PAY_SYNTHETIC_ONLY'
    },
    nodeVersion: '22.12.0',
    gitRevision: async () => pin,
    isClean: async () => true,
    checkPort: async () => undefined
  });
  assert.equal(preflight.status, 'READY_FOR_PRIVATE_OPERATOR_START');
  assert.equal(preflight.publicFaiscaEnabled, false);
  assert.equal(preflight.realApiCalled, false);
  await assert.rejects(readFile(join(directory, 'faisca-reservations.json')), { code: 'ENOENT' });

  let calls = 0;
  const lab = {
    async answer(caseId) {
      calls++;
      const id = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES[caseId])[0];
      const reviewed = getGroundedAnswer(id);
      assert.ok(reviewed, 'R06 pinned recipe must exist');
      return {
        schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA,
        status: 'draft_answer', answerId: id,
        text: 'O site Onepage reúne conteúdos essenciais em uma página. O escopo é definido em proposta revisada.',
        sourceIds: reviewed.sources.map(source => source.id),
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ calls, externalModelInvocations: 0 })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const smoke = await inspectFaiscaPrivateReviewUi({ origin: server.address });
  assert.equal(smoke.status, 'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(smoke.requests, 3);
  assert.equal(smoke.modelInvocations, 0);
  assert.equal(calls, 0, 'Static staging smoke must never invoke models.');

  const response = await fetch(server.address + server.path, {
    method: 'POST', credentials: 'omit', redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: 'compare' })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sourceRecipeBound, true);
  assert.deepEqual(body.models, ['gpt-6-luna', 'gpt-6.1-terra']);
  assert.equal(body.requiresEditorialReview, true);
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
  assert.equal(calls, 1, 'One synthetic post invokes the injected fixture only.');
  await assert.rejects(readFile(join(directory, 'faisca-reservations.json')), { code: 'ENOENT' });
});
