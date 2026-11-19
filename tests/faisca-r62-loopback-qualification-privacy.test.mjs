import test from 'node:test';
import assert from 'node:assert/strict';
import { request as requestHttp } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { startHttpLab } from '../ops/faisca/server/http-lab.mjs';
import { createQualificationPrepareTurn } from '../ops/faisca/qualification/http-runtime.mjs';
import { CONVERSATION_SCHEMA } from '../ops/faisca/conversation-contract.mjs';
import { HTTP_PATHS, HTTP_SESSION_SCHEMA, HTTP_RESULT_SCHEMA } from '../ops/faisca/http-contract.mjs';

async function fixture(t) {
  const staticDir = await mkdtemp(resolve(tmpdir(), 'faisca-r62-loopback-'));
  t.after(() => rm(staticDir, { recursive: true, force: true }));
  await mkdir(resolve(staticDir, 'http'));
  await writeFile(resolve(staticDir, 'index.html'), '<!doctype html><title>R62 Synthetic</title>');
  await writeFile(resolve(staticDir, 'http/index.html'), '<!doctype html><title>R62 Synthetic HTTP</title>');
  const server = await startHttpLab({
    enabled: '1', port: 0, staticDir, delayMs: 0, timeoutMs: 500,
    prepareTurnFactory: createQualificationPrepareTurn
  });
  t.after(() => server.close());
  assert.match(server.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  return server;
}

function post(server, path, body, token = null) {
  const target = new URL(server.origin);
  const payload = JSON.stringify(body);
  const headers = {
    Host: target.host, Origin: server.origin,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...(token ? { Authorization: 'Bearer ' + token } : {})
  };
  return new Promise((resolveReply, rejectReply) => {
    const request = requestHttp({
      hostname: '127.0.0.1', port: target.port, path,
      method: 'POST', headers, agent: false
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = JSON.parse(text); } catch { data = null; }
        resolveReply({ status: response.statusCode, text, data });
      });
      response.on('error', rejectReply);
    });
    request.on('error', rejectReply);
    request.end(payload);
  });
}

async function open(server) {
  const response = await post(server, HTTP_PATHS.sessions, {});
  assert.equal(response.status, 201);
  assert.equal(response.data.schema, HTTP_SESSION_SCHEMA);
  assert.match(response.data.token, /^[a-f0-9]{64}$/);
  return response.data;
}
async function send(server, session, number, input, token = session.token, conversationId = session.conversationId) {
  const reply = await post(server, HTTP_PATHS.messages, {
    schema: CONVERSATION_SCHEMA,
    conversationId, messageId: 'r62_synthetic_' + String(number).padStart(4, '0'),
    locale: 'pt-BR', input
  }, token);
  if (reply.status === 200) assert.equal(reply.data.schema, HTTP_RESULT_SCHEMA);
  return reply;
}
const action = id => ({ type: 'action', id });

test('R62: HTTP loopback never returns unknown qualification prose and keeps a pending service change non-operational', async t => {
  const server = await fixture(t);
  const session = await open(server);
  let reply = await send(server, session, 1, action('goal_presence'));
  assert.equal(reply.status, 200);
  reply = await send(server, session, 2, action('confirm_goal'));
  assert.equal(reply.status, 200);
  assert.match(reply.data.response.text, /principal resultado/);

  const marker = 'MARCADOR_SINTETICO_PRIVADO_R62_HTTP';
  reply = await send(server, session, 3, { type: 'text', text: marker });
  assert.equal(reply.status, 200);
  assert.match(reply.data.response.text, /principal resultado/);
  assert.equal(reply.text.includes(marker), false);

  reply = await send(server, session, 4, { type: 'text', text: 'Quero Landing Page. ' + marker });
  assert.equal(reply.status, 200);
  assert.match(reply.data.response.text, /troca de solução está pendente/);
  assert.equal(reply.text.includes(marker), false);

  reply = await send(server, session, 5, action('r08:prepare_onepage'));
  assert.equal(reply.status, 200);
  assert.match(reply.data.response.text, /Confirme a nova opção ou cancele/);
  assert.doesNotMatch(reply.data.response.text, /cotação calculada pelo Portal/);

  reply = await send(server, session, 6, action('cancel_goal'));
  assert.equal(reply.status, 200);
  reply = await send(server, session, 7, action('r08:summary'));
  assert.equal(reply.status, 200);
  assert.match(reply.data.response.text, /Site Onepage/);
  assert.equal(reply.text.includes(marker), false);
  assert.equal(server.inspect().sessions, 1);
});

test('R62: HTTP session tokens cannot inspect another visitor draft or authorize a Portal preview', async t => {
  const server = await fixture(t);
  const onepage = await open(server);
  const landing = await open(server);

  assert.equal((await send(server, onepage, 1, action('goal_presence'))).status, 200);
  assert.equal((await send(server, onepage, 2, action('confirm_goal'))).status, 200);
  assert.equal((await send(server, landing, 1, action('goal_campaign'))).status, 200);
  assert.equal((await send(server, landing, 2, action('confirm_goal'))).status, 200);

  const wrongToken = await send(server, landing, 3, action('r08:summary'), onepage.token);
  assert.equal(wrongToken.status, 403);
  assert.equal(wrongToken.data.code, 'conversation_mismatch');

  const draftOnepage = await send(server, onepage, 3, action('r08:summary'));
  const draftLanding = await send(server, landing, 3, action('r08:summary'));
  assert.equal(draftOnepage.status, 200);
  assert.equal(draftLanding.status, 200);
  assert.match(draftOnepage.data.response.text, /Site Onepage/);
  assert.match(draftLanding.data.response.text, /Landing Page/);
  assert.doesNotMatch(draftLanding.data.response.text, /Solução confirmada: Site Onepage/);

  for (const user of [onepage, landing]) {
    const response = await send(server, user, 4, action('r08:prepare_onepage'));
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.data.response.text, /cotação calculada pelo Portal/);
    assert.match(response.data.response.text, /Nenhuma cotação ou pedido foi criado/);
  }
  assert.equal(server.inspect().sessions, 2);
  assert.equal(server.inspect().dispatched >= 0, true);
});

test('R69: anonymous HTTP sales prose cannot bypass Onepage consent, identity or completed qualification', async t => {
  const server = await fixture(t);
  const visitor = await open(server);
  const marker = 'R69_SYNTHETIC_PRIVATE_PREQUAL_MARKER';
  const unknown = await send(server, visitor, 1, { type: 'text', text: marker });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.status, 'answered');
  assert.equal(unknown.text.includes(marker), false);
  assert.equal(unknown.data.response.sources.length, 0);

  const proposal = await send(server, visitor, 2, {
    type: 'text', text: 'Quero avaliar Site Onepage. ' + marker
  });
  assert.equal(proposal.status, 200);
  assert.equal(proposal.text.includes(marker), false);
  assert.match(proposal.data.response.text, /Confirme a escolha/);
  const premature = await send(server, visitor, 3, action('r08:prepare_onepage'));
  assert.equal(premature.status, 200);
  assert.match(premature.data.response.text, /Nenhuma cotação ou pedido foi criado/);
  assert.doesNotMatch(premature.data.response.text, /cotação calculada pelo Portal/);

  const confirmation = await send(server, visitor, 4, action('confirm_goal'));
  assert.equal(confirmation.status, 200);
  assert.match(confirmation.data.response.text, /principal resultado/);
  const stillIncomplete = await send(server, visitor, 5, action('r08:prepare_onepage'));
  assert.equal(stillIncomplete.status, 200);
  assert.match(stillIncomplete.data.response.text, /Nenhuma cotação ou pedido foi criado/);
  for (const response of [unknown, proposal, premature, confirmation, stillIncomplete]) {
    assert.equal(response.text.includes(marker), false);
    assert.equal(response.text.includes('checkoutUrl'), false);
    assert.equal(response.text.includes('paymentRequested'), false);
  }
  assert.equal(server.inspect().sessions, 1);
});
