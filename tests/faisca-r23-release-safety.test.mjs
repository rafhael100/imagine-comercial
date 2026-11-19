import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { publicFaiscaEnabled } from '../ops/faisca/lab/lab-policy.mjs';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { routeWithLocalFixture } from '../ops/faisca/model-router/contract.mjs';
import { createModelRouteRuntime } from '../ops/faisca/model-router/runtime.mjs';

const source = name => readFile(new URL(name, import.meta.url), 'utf8');
const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });

test('R23 reconciliation does not activate the public widget, payment or live model', () => {
  assert.equal(publicFaiscaEnabled, false);
  const result = routeWithLocalFixture({
    conversationId: 'r23_release_gate_session',
    messageId: 'r23_release_gate_message',
    userText: 'Quero cancelar meu contrato.'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.routeStatus, 'authentication_required');
  assert.equal(result.provenance, 'host_fixed_boundary');
  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.actions, []);
});

test('R23 keeps R15 private-turn masking after R16-R22 additions', () => {
  let session = choose(createQualificationJourney(), 'goal_presence').session;
  session = choose(session, 'confirm_goal').session;
  session = choose(session, 'r08:objective:present_company').session;
  session = choose(session, 'r08:change_service').session;
  session = choose(session, 'goal_campaign').session;
  assert.equal(session.phase, 'service_change_pending');
  const sensitive = respondQualificationJourney(session, {
    type: 'text', text: 'Minha senha é SENHA_REVIEW_R23.'
  });
  assert.equal(sensitive.userText, '[Mensagem livre não registrada]');
  assert.equal(sensitive.reply.intent, 'r08_service_change_pending');
  assert.deepEqual(sensitive.reply.actions.map(x => x.id), ['confirm_goal', 'cancel_goal']);
  assert.equal(sensitive.session.profile.service, 'onepage');
  assert.doesNotMatch(JSON.stringify(sensitive), /SENHA_REVIEW_R23/);
});

test('R23 retains R15 browser cancel and HTTP privacy guards', async () => {
  const [transport, browser] = await Promise.all([
    source('../ops/faisca/lab/http-client.mjs'),
    source('../ops/faisca/qualification/http-browser-qa.mjs')
  ]);
  assert.match(transport, /inPendingQualification/);
  assert.match(transport, /confirm_goal/);
  assert.match(transport, /cancel_goal/);
  assert.match(browser, /async function nextVisibleReply/);
  assert.match(browser, /await quick\('cancel_goal'\)/);
  assert.match(browser, /await assertGroundedSource\('compare_sites'\)/);
});

test('R23 preserves the exact approved PNG in this integration tree', async () => {
  const bytes = await readFile(new URL('../ops/faisca/assets/faisca-master.png', import.meta.url));
  const manifest = JSON.parse(await source('../ops/faisca/asset-manifest.json'));
  const sha = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha, '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d');
  assert.equal(sha, manifest.sha256);
  assert.equal(bytes.length, manifest.size_bytes);
});

test('R23 still blocks public checkout and private-review HTTP routes', async () => {
  const [portal, review] = await Promise.all([
    source('../src/lib/public-portal-checkout-readiness.mjs'),
    source('../ops/faisca/review/static-server.mjs')
  ]);
  assert.match(portal, /publicCheckoutAuthorized:false/);
  assert.match(portal, /portalLoginOrRedirectAuthorized:false/);
  assert.match(review, /DISABLED_HTTP_ROUTES/);
  assert.match(review, /connect-src 'none'/);
  assert.match(review, /127\.0\.0\.1/);
  assert.match(review, /Review pages are read only/);
});

test('R23 cannot route private requests to simulated model even after integration', async () => {
  let calls = 0;
  const runtime = createModelRouteRuntime({ provider: {
    kind: 'simulated',
    route() { calls++; throw new Error('Private question dispatched'); }
  } });
  try {
    const response = await runtime.send({
      conversationId: 'r23_guard_conversation',
      messageId: 'r23_guard_message',
      userText: 'Qual o andamento do meu pedido?'
    });
    assert.equal(response.status, 'answered');
    assert.equal(response.delivery, 'fixed_boundary');
    assert.equal(response.route.routeStatus, 'authentication_required');
    assert.equal(response.externalModelInvocations, 0);
    assert.equal(calls, 0);
  } finally { runtime.destroy(); }
});
