import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGroundedModelPipeline
} from '../ops/faisca/model-router/grounded-pipeline.mjs';
import { createLocalModelRouteProvider } from '../ops/faisca/model-router/runtime.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const input = (messageId, userText = 'Como funciona o projeto?', conversationId = 'r09_pipeline_conversation_01') =>
  ({ conversationId, messageId, userText });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function exactGroundedProvider(onCall = () => {}) {
  return {
    kind: 'simulated',
    respond(request, { candidate }) { onCall(request, candidate); return candidate; }
  };
}

test('R09 pipeline routes natural-language questions then requires R06 grounded evidence', async () => {
  const calls = [];
  const pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider(),
    groundedProvider: exactGroundedProvider((request, candidate) => calls.push({ request, candidate }))
  });
  try {
    const process = await pipeline.send(input('r09_pipeline_process_01'));
    assert.equal(process.status, 'answered');
    assert.equal(process.delivery, 'php_grounded');
    assert.equal(process.route.answerId, 'process');
    assert.equal(process.reply.text, getGroundedAnswer('process').text);
    assert.deepEqual(process.reply.sources, getGroundedAnswer('process').sources.map(({ id, title }) => ({ id, title })));
    assert.equal(calls.length, 1);

    const price = await pipeline.send(input('r09_pipeline_price_01', 'Quanto custa?'));
    assert.equal(price.status, 'answered');
    assert.equal(price.route.answerId, 'pricing');
    assert.equal(price.reply.text, getGroundedAnswer('pricing').text);
    assert.equal(calls.length, 2);
    assert.equal(process.externalModelInvocations, 0);
    assert.equal(process.operationalEffects, false);
  } finally { pipeline.destroy(); }
});

test('R09 pipeline never commits service-selection candidates; it asks a fixed clarification', async () => {
  let groundedCalls = 0;
  const pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider(),
    groundedProvider: exactGroundedProvider(() => groundedCalls++)
  });
  try {
    const response = await pipeline.send(input('r09_pipeline_service_01', 'Quero apresentar minha empresa.'));
    assert.equal(response.status, 'answered');
    assert.equal(response.delivery, 'fixed_clarification');
    assert.equal(response.route.clarificationId, 'service_choice');
    assert.match(response.reply.text, /site para apresentar sua empresa/);
    assert.deepEqual(response.reply.sources, []);
    assert.equal(groundedCalls, 0);
  } finally { pipeline.destroy(); }
});

test('R09 ads service candidates ask for a business goal instead of silently selecting a channel', async () => {
  let groundedCalls = 0;
  const pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider(),
    groundedProvider: exactGroundedProvider(() => groundedCalls++)
  });
  try {
    const response = await pipeline.send(input('r09_pipeline_ads_01', 'Quero anunciar no Instagram.'));
    assert.equal(response.status, 'answered');
    assert.equal(response.delivery, 'fixed_clarification');
    assert.equal(response.route.answerId, null);
    assert.equal(response.route.clarificationId, 'goal_clarification');
    assert.match(response.reply.text, /principal resultado/);
    assert.deepEqual(response.reply.sources, []);
    assert.equal(groundedCalls, 0);
  } finally { pipeline.destroy(); }
});

test('R09 pipeline returns unsupported locally and never asks PHP to validate absent sources', async () => {
  let groundedCalls = 0;
  const pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider(),
    groundedProvider: exactGroundedProvider(() => groundedCalls++)
  });
  try {
    const response = await pipeline.send(input('r09_pipeline_unknown_01', 'Qual é a cor favorita do mascote?'));
    assert.equal(response.status, 'answered');
    assert.equal(response.route.routeStatus, 'unsupported');
    assert.equal(response.delivery, 'fixed_fallback');
    assert.deepEqual(response.reply.sources, []);
    assert.equal(groundedCalls, 0);
  } finally { pipeline.destroy(); }
});

test('R09 pipeline withholds all answer text and citations when R06 grounding fails', async () => {
  const pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider(),
    groundedProvider: { kind: 'simulated', respond() { throw new Error('synthetic PHP unavailable'); } }
  });
  try {
    const response = await pipeline.send(input('r09_pipeline_php_failure_01'));
    assert.equal(response.status, 'unavailable');
    assert.equal(response.delivery, 'none');
    assert.match(response.reply.text, /Não consegui confirmar/);
    assert.deepEqual(response.reply.sources, []);
  } finally { pipeline.destroy(); }
});

test('R09 pipeline reconciles a timed-out route before starting R06 grounding', async () => {
  let groundedCalls = 0;
  const pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider({ delayMs: 40 }),
    routeTimeoutMs: 10,
    groundedProvider: exactGroundedProvider(() => groundedCalls++)
  });
  const request = input('r09_pipeline_route_timeout_01');
  try {
    const initial = await pipeline.send(request);
    assert.equal(initial.status, 'unknown');
    assert.equal(groundedCalls, 0);
    await wait(50);
    const final = await pipeline.reconcile(request);
    assert.equal(final.status, 'answered');
    assert.equal(final.delivery, 'php_grounded');
    assert.equal(final.route.answerId, 'process');
    assert.equal(groundedCalls, 1);
  } finally { pipeline.destroy(); }
});

test('R09 pipeline reconciles a timed-out R06 response without a second dispatch', async () => {
  let groundedCalls = 0;
  const pipeline = createGroundedModelPipeline({
    routeProvider: createLocalModelRouteProvider(),
    groundedTimeoutMs: 10,
    groundedProvider: {
      kind: 'simulated',
      async respond(_request, { candidate }) { groundedCalls++; await wait(40); return candidate; }
    }
  });
  const request = input('r09_pipeline_php_timeout_01');
  try {
    const initial = await pipeline.send(request);
    assert.equal(initial.status, 'unknown');
    assert.equal(groundedCalls, 1);
    await wait(50);
    const final = await pipeline.reconcile(request);
    assert.equal(final.status, 'answered');
    assert.equal(final.delivery, 'php_grounded');
    assert.equal(final.reply.text, getGroundedAnswer('process').text);
    assert.equal(groundedCalls, 1);
  } finally { pipeline.destroy(); }
});
