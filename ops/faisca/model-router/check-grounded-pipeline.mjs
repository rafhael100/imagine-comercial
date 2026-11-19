import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGroundedModelPipeline } from './grounded-pipeline.mjs';
import { createLocalModelRouteProvider } from './runtime.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';
import { prepareGroundedBridge } from '../grounding/php-provider.mjs';
import { bridgeCounts, readGroundedQaConfiguration } from '../grounding/check-interop.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(directory, '../reports/Faisca_R09_GROUNDED_PIPELINE_QA.json');
let configuration, bridge, pipeline, fatal;
const results = [];
let executedPHP = false;

async function check(name, operation) {
  await operation();
  results.push({ name, status: 'pass' });
  process.stdout.write('PASS ' + name + '\n');
}
const input = (messageId, userText) => ({
  conversationId: 'r09_php_pipeline_conversation',
  messageId, userText
});

try {
  configuration = await readGroundedQaConfiguration();
  const pinCheck = await prepareGroundedBridge(configuration);
  await pinCheck.close();
  bridge = await prepareGroundedBridge({ ...configuration, scenario: 'success', delayMs: 0 });
  pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider(),
    groundedProvider: bridge.createProvider(),
    routeTimeoutMs: 1000, groundedTimeoutMs: 5000
  });

  await check('R09 natural-language retrieval selects process and PHP validates the exact editorial answer', async () => {
    const response = await pipeline.send(input('r09_php_process_0001', 'Como funciona o projeto?'));
    assert.equal(response.status, 'answered');
    assert.equal(response.delivery, 'php_grounded');
    assert.equal(response.route.answerId, 'process');
    assert.equal(response.reply.text, getGroundedAnswer('process').text);
    assert.deepEqual(response.reply.sources, getGroundedAnswer('process').sources.map(({ id, title }) => ({ id, title })));
    assert.equal(response.externalModelInvocations, 0);
    executedPHP = true;
  });

  await check('R09 accented Portuguese price question retrieves pricing and PHP validates it', async () => {
    const response = await pipeline.send(input('r09_php_pricing_0001', 'Quanto custa?'));
    assert.equal(response.status, 'answered');
    assert.equal(response.delivery, 'php_grounded');
    assert.equal(response.route.answerId, 'pricing');
    assert.equal(response.reply.text, getGroundedAnswer('pricing').text);
    assert.deepEqual(response.reply.sources, getGroundedAnswer('pricing').sources.map(({ id, title }) => ({ id, title })));
  });

  await check('R09 comparison question is grounded without changing a service selection', async () => {
    const response = await pipeline.send(input('r09_php_compare_0001', 'Qual a diferença entre Onepage e Landing Page?'));
    assert.equal(response.status, 'answered');
    assert.equal(response.delivery, 'php_grounded');
    assert.equal(response.route.answerId, 'compare_sites');
    assert.equal(response.reply.text, getGroundedAnswer('compare_sites').text);
  });

  await check('R09 service-selection candidate becomes a fixed clarification and does not spawn PHP', async () => {
    const before = bridgeCounts(bridge).spawned;
    const response = await pipeline.send(input('r09_php_service_0001', 'Quero apresentar minha empresa.'));
    assert.equal(response.status, 'answered');
    assert.equal(response.delivery, 'fixed_clarification');
    assert.equal(response.route.clarificationId, 'service_choice');
    assert.deepEqual(response.reply.sources, []);
    assert.equal(bridgeCounts(bridge).spawned, before);
  });

  await check('R09 unsupported and sensitive messages never reach PHP', async () => {
    const before = bridgeCounts(bridge).spawned;
    const unsupported = await pipeline.send(input('r09_php_unknown_0001', 'Qual é a cor favorita do mascote?'));
    assert.equal(unsupported.status, 'answered');
    assert.equal(unsupported.route.routeStatus, 'unsupported');
    const privateMessage = await pipeline.send(input('r09_php_private_0001',
      'Meu telefone é +55 85 99999-9999 e quero uma Landing Page.'));
    assert.equal(privateMessage.status, 'invalid_request');
    assert.equal(bridgeCounts(bridge).spawned, before);
  });

  await check('R09 pipeline closes with no PHP children pending', async () => {
    assert.equal(bridgeCounts(bridge).pending, 0);
    assert.equal(pipeline.inspect().route.pending, 0);
    assert.equal(pipeline.inspect().grounding.pending, 0);
    assert.equal(pipeline.inspect().externalModelInvocations, 0);
  });
} catch (error) {
  fatal = { code: error?.code ?? 'r09_pipeline_failure', message: error.message };
  process.exitCode = 1;
} finally {
  pipeline?.destroy();
  await bridge?.close().catch(() => {});
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({
    status: fatal ? 'failed' : 'passed',
    executedPHP,
    agentsCommit: configuration?.pin.commit ?? null,
    knowledgeVersion: configuration?.pin.knowledgeVersion ?? null,
    knowledgeDigest: configuration?.pin.knowledgeDigest ?? null,
    php: bridge ? bridgeCounts(bridge) : null,
    scope: 'R09 deterministic candidate retrieval + simulated route fixture + pinned real PHP R06 validation; no external model or operational effects',
    externalModelInvocations: 0,
    operationalEffects: false,
    results, fatal
  }, null, 2) + '\n');
  process.stdout.write('R09 grounded pipeline: ' + results.length + '/' + results.length + ' passed; executedPHP=' + executedPHP + '.\n');
  if (fatal) process.stderr.write(fatal.code + ': ' + fatal.message + '\n');
}
