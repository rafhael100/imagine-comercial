import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { startHttpLab } from '../ops/faisca/server/http-lab.mjs';
import { CONVERSATION_SCHEMA } from '../ops/faisca/conversation-contract.mjs';
import { HTTP_SESSION_SCHEMA, HTTP_RESULT_SCHEMA, HTTP_CONTEXT, HTTP_PATHS } from '../ops/faisca/http-contract.mjs';

const sleep = ms => new Promise(yes => setTimeout(yes, ms));
async function until(predicate) {
  const end = Date.now() + 2000;
  while (!predicate()) { if (Date.now() > end) throw new Error('HTTP fixture did not reach expected state.'); await sleep(2); }
}
async function staticFixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'faisca-http-synthetic-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(resolve(directory, '_astro')); await mkdir(resolve(directory, 'http'));
  await writeFile(resolve(directory, 'index.html'), '<!doctype html><title>Synthetic guided lab</title>');
  await writeFile(resolve(directory, 'http/index.html'), '<!doctype html><title>Synthetic HTTP lab</title>');
  await writeFile(resolve(directory, '_astro/test.abc.js'), 'export const synthetic = true;');
  await writeFile(resolve(directory, '_astro/test.abc.css'), 'body { color: #111; }');
  return directory;
}
async function fixture(t, options = {}) {
  const staticDir = await staticFixture(t);
  const lab = await startHttpLab({ enabled: '1', staticDir, delayMs: 0, ...options });
  t.after(() => lab.close());
  return lab;
}
function call(lab, path = HTTP_PATHS.sessions, { method = 'POST', body = {}, text, headers = {} } = {}) {
  const url = new URL(lab.origin);
  const payload = text ?? JSON.stringify(body);
  const merged = { Host: url.host, Origin: lab.origin, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers };
  for (const [key, value] of Object.entries(merged)) if (value === null) delete merged[key];
  return new Promise((yes, no) => {
    const req = httpRequest({ hostname: '127.0.0.1', port: url.port, path, method, headers: merged, agent: false }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json; try { json = JSON.parse(text); } catch { json = null; }
        yes({ status: res.statusCode, headers: res.headers, text, json });
      });
      res.on('error', no);
    });
    req.on('error', no); req.end(payload);
  });
}
const auth = session => ({ Authorization: 'Bearer ' + session.token });
const envelope = (session, changes = {}) => ({ schema: CONVERSATION_SCHEMA, conversationId: session.conversationId,
  messageId: 'message_synthetic_0001', locale: 'pt-BR', input: { type: 'action', id: 'goal_presence' }, ...changes });
async function session(lab) {
  const result = await call(lab); assert.equal(result.status, 201);
  return result.json;
}
function deferredProvider() {
  const work = [];
  return { kind: 'simulated', work, respond(request, { candidate }) {
    return new Promise((resolve, reject) => work.push({ request, candidate, resolve, reject }));
  } };
}
function raw(lab, head) {
  const port = Number(new URL(lab.origin).port);
  return new Promise((yes, no) => {
    const socket = connect({ host: '127.0.0.1', port }); const chunks = [];
    socket.setTimeout(2500, () => { socket.destroy(); no(new Error('Raw HTTP fixture timed out.')); });
    socket.on('connect', () => socket.write(head));
    socket.on('data', chunk => chunks.push(chunk));
    socket.on('error', no);
    socket.on('close', () => { const text = Buffer.concat(chunks).toString('utf8'); yes({ status: Number(/^HTTP\/1\.1 (\d+)/.exec(text)?.[1]), text }); });
  });
}

test('HTTP lab requires exact activation and a numeric port before listening', async () => {
  for (const enabled of [undefined, true, 1, 'true', '0']) await assert.rejects(startHttpLab({ enabled }), /required/);
  await assert.rejects(startHttpLab({ enabled: '1', port: '4330' }), /configuration/);
  await assert.rejects(startHttpLab({ enabled: '1', port: -1 }), /configuration/);
});

test('session response fixes server context and creates only volatile laboratory authority', async t => {
  const lab = await fixture(t); const value = await session(lab);
  assert.match(lab.origin, /^http:\/\/127\.0\.0\.1:[0-9]+$/);
  assert.equal(value.schema, HTTP_SESSION_SCHEMA); assert.match(value.token, /^[a-f0-9]{64}$/);
  assert.match(value.conversationId, /^[a-f0-9]{32}$/); assert.equal(value.expiresInMs, 300000);
  assert.deepEqual(value.context, HTTP_CONTEXT);
  assert.equal(value.context.operationalEffects, false); assert.equal(value.context.provider, 'simulated');
  assert.equal(lab.inspect().sessions, 1); assert.equal(lab.inspect().dispatched, 0);
  assert.equal(JSON.stringify(lab.inspect()).includes(value.token), false);
});

test('missing/null/foreign Origin and wrong Host cannot create sessions, with no CORS grant', async t => {
  const lab = await fixture(t);
  for (const Origin of [null, 'null', 'https://untrusted.invalid', lab.origin + '/']) {
    const result = await call(lab, HTTP_PATHS.sessions, { headers: { Origin } });
    assert.equal(result.status, 403); assert.equal(result.json.code, 'invalid_origin');
    assert.equal(result.headers['access-control-allow-origin'], undefined);
  }
  const wrongHost = await call(lab, HTTP_PATHS.sessions, { headers: { Host: 'localhost:' + new URL(lab.origin).port } });
  assert.equal(wrongHost.status, 400); assert.equal(wrongHost.json.code, 'invalid_host');
  const forwarded = await call(lab, HTTP_PATHS.sessions, { headers: { Origin: 'https://untrusted.invalid', 'X-Forwarded-Host': new URL(lab.origin).host, 'X-Forwarded-Proto': 'http' } });
  assert.equal(forwarded.status, 403); assert.equal(lab.inspect().createdSessions, 0);
  const options = await call(lab, HTTP_PATHS.sessions, { method: 'OPTIONS' });
  assert.equal(options.status, 405); assert.equal(options.headers['access-control-allow-methods'], undefined);
});

test('raw duplicate Host, Origin and Authorization headers are rejected before runtime dispatch', async t => {
  const lab = await fixture(t); const value = await session(lab); const host = new URL(lab.origin).host;
  for (const duplicate of ['Host: ' + host, 'Origin: ' + lab.origin, 'Authorization: Bearer ' + value.token]) {
    const result = await raw(lab, 'POST ' + HTTP_PATHS.messages + ' HTTP/1.1\r\nHost: ' + host + '\r\nOrigin: ' + lab.origin +
      '\r\nAuthorization: Bearer ' + value.token + '\r\n' + duplicate + '\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}');
    assert.equal(result.status, 400);
  }
  assert.equal(lab.inspect().dispatched, 0);
});

test('session body cannot select tenant, source, provider, role, or conversation identity', async t => {
  const lab = await fixture(t);
  for (const body of [[], null, { tenant_id: 'forged' }, { provider: 'real' }, { role: 'admin' }, { conversationId: 'forged' }]) {
    const result = await call(lab, HTTP_PATHS.sessions, { body });
    assert.equal(result.status, 400); assert.equal(result.json.code, 'invalid_request');
  }
  assert.equal(lab.inspect().createdSessions, 0);
});

test('messages require exact bearer ownership and correlation to the server-created conversation', async t => {
  const lab = await fixture(t); const a = await session(lab); const b = await session(lab);
  for (const Authorization of [null, 'Bearer ' + 'a'.repeat(64), 'Bearer ' + a.token + ', Bearer ' + b.token, 'Basic ' + a.token]) {
    const result = await call(lab, HTTP_PATHS.messages, { body: envelope(a), headers: { Authorization } });
    assert.equal(result.status, 401);
  }
  const mismatch = await call(lab, HTTP_PATHS.messages, { body: envelope(b), headers: auth(a) });
  assert.equal(mismatch.status, 403); assert.equal(mismatch.json.code, 'conversation_mismatch');
  const extra = await call(lab, HTTP_PATHS.messages, { body: { ...envelope(a), tenant_id: 'forged' }, headers: auth(a) });
  assert.equal(extra.status, 400); assert.equal(lab.inspect().dispatched, 0);
  const accepted = await call(lab, HTTP_PATHS.messages, { body: envelope(a), headers: auth(a) });
  assert.equal(accepted.status, 200); assert.equal(accepted.json.schema, HTTP_RESULT_SCHEMA);
  assert.equal(accepted.json.status, 'answered'); assert.equal(accepted.json.response.conversationId, a.conversationId);
  assert.equal(accepted.json.response.messageId, envelope(a).messageId); assert.match(accepted.json.response.text, /Site Onepage/);
});

test('simultaneous HTTP retries reuse a single runtime operation and identical response', async t => {
  const provider = deferredProvider(); const lab = await fixture(t, { createProvider: () => provider, timeoutMs: 1000 });
  const value = await session(lab); const body = envelope(value);
  const first = call(lab, HTTP_PATHS.messages, { body, headers: auth(value) });
  const second = call(lab, HTTP_PATHS.messages, { body, headers: auth(value) });
  await until(() => lab.inspect().messages === 2 && provider.work.length === 1);
  provider.work[0].resolve(provider.work[0].candidate);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.deepEqual(a.json, b.json);
  assert.equal(lab.inspect().dispatched, 1);
});

test('same HTTP message ID with changed body is conflict, not a second provider call', async t => {
  const lab = await fixture(t); const value = await session(lab);
  await call(lab, HTTP_PATHS.messages, { body: envelope(value), headers: auth(value) });
  const conflict = await call(lab, HTTP_PATHS.messages, { body: envelope(value, { input: { type: 'action', id: 'pricing' } }), headers: auth(value) });
  assert.equal(conflict.status, 200); assert.equal(conflict.json.status, 'conflict'); assert.equal(conflict.json.accepted, false);
  assert.equal(lab.inspect().dispatched, 1);
});

test('HTTP timeout can be reconciled later without redispatch or retry after uncertainty', async t => {
  const provider = deferredProvider(); const lab = await fixture(t, { createProvider: () => provider, timeoutMs: 10 });
  const value = await session(lab); const body = envelope(value);
  const unknown = await call(lab, HTTP_PATHS.messages, { body, headers: auth(value) });
  assert.equal(unknown.status, 200); assert.equal(unknown.json.status, 'unknown'); assert.equal(unknown.json.delivery, 'unknown');
  const retry = await call(lab, HTTP_PATHS.messages, { body, headers: auth(value) });
  assert.deepEqual(retry.json, unknown.json);
  const pending = await call(lab, HTTP_PATHS.reconcile, { body, headers: auth(value) });
  assert.equal(pending.json.status, 'unknown'); assert.equal(lab.inspect().dispatched, 1);
  provider.work[0].resolve(provider.work[0].candidate);
  const final = await call(lab, HTTP_PATHS.reconcile, { body, headers: auth(value) });
  assert.equal(final.json.status, 'answered'); assert.equal(final.json.delivery, 'simulated');
  assert.equal(lab.inspect().dispatched, 1);
});

test('HTTP client disconnect preserves session and dispatched result for later reconciliation', async t => {
  const provider = deferredProvider(); const lab = await fixture(t, { createProvider: () => provider, timeoutMs: 1000 });
  const value = await session(lab); const body = envelope(value); const text = JSON.stringify(body); const url = new URL(lab.origin);
  const req = httpRequest({ hostname: '127.0.0.1', port: url.port, path: HTTP_PATHS.messages, method: 'POST', agent: false,
    headers: { Host: url.host, Origin: lab.origin, ...auth(value), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } });
  req.on('error', () => {}); req.end(text);
  await until(() => lab.inspect().dispatched === 1); req.destroy();
  provider.work[0].resolve(provider.work[0].candidate);
  const result = await call(lab, HTTP_PATHS.reconcile, { body, headers: auth(value) });
  assert.equal(result.status, 200); assert.equal(result.json.status, 'answered');
  assert.equal(lab.inspect().sessions, 1); assert.equal(lab.inspect().dispatched, 1);
});

test('session capacity does not evict a live session and TTL expiry revokes its token', async t => {
  let time = 1000; const lab = await fixture(t, { maxSessions: 1, sessionTtlMs: 50, now: () => time });
  const value = await session(lab);
  const capacity = await call(lab); assert.equal(capacity.status, 429); assert.equal(capacity.json.code, 'session_capacity');
  const valid = await call(lab, HTTP_PATHS.messages, { body: envelope(value), headers: auth(value) });
  assert.equal(valid.json.status, 'answered');
  time += 51;
  const expired = await call(lab, HTTP_PATHS.messages, { body: envelope(value), headers: auth(value) });
  assert.equal(expired.status, 401); assert.equal(lab.inspect().expiredSessions, 1);
  const replacement = await session(lab); assert.notEqual(replacement.conversationId, value.conversationId);
  assert.equal(lab.inspect().dispatched, 1);
});

test('session expiry while the HTTP body is being read is rechecked before dispatch', async t => {
  let time = 1000;
  const lab = await fixture(t, { sessionTtlMs: 50, now: () => time });
  const value = await session(lab); const text = JSON.stringify(envelope(value)); const url = new URL(lab.origin);
  let req;
  const resultPromise = new Promise((yes, no) => {
    req = httpRequest({ hostname: '127.0.0.1', port: url.port, path: HTTP_PATHS.messages, method: 'POST', agent: false,
      headers: { Host: url.host, Origin: lab.origin, ...auth(value), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => yes({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
      res.on('error', no);
    });
    req.on('error', no);
    req.write(text.slice(0, 10));
  });
  // The handler has accepted headers and started body reading with a live token.
  await until(() => lab.inspect().inflight === 1);
  assert.equal(lab.inspect().sessions, 1); assert.equal(lab.inspect().dispatched, 0);
  time += 51;
  req.end(text.slice(10));
  const result = await resultPromise;
  assert.equal(result.status, 401); assert.equal(result.body.code, 'unauthorized');
  assert.equal(lab.inspect().dispatched, 0); assert.equal(lab.inspect().sessions, 0);
  assert.equal(lab.inspect().expiredSessions, 1);
});

test('session expiry while the provider is working prevents late delivery without redispatch', async t => {
  let time = 1000; const provider = deferredProvider();
  const lab = await fixture(t, { sessionTtlMs: 50, now: () => time, timeoutMs: 1000, createProvider: () => provider });
  const value = await session(lab); const body = envelope(value);
  const pending = call(lab, HTTP_PATHS.messages, { body, headers: auth(value) });
  await until(() => provider.work.length === 1);
  assert.equal(lab.inspect().dispatched, 1);
  time += 51;
  provider.work[0].resolve(provider.work[0].candidate);
  const result = await pending;
  assert.equal(result.status, 401); assert.equal(result.json.code, 'unauthorized');
  assert.equal(Object.hasOwn(result.json, 'response'), false);
  assert.equal(lab.inspect().sessions, 0); assert.equal(lab.inspect().expiredSessions, 1);
  const reconcile = await call(lab, HTTP_PATHS.reconcile, { body, headers: auth(value) });
  assert.equal(reconcile.status, 401); assert.equal(lab.inspect().dispatched, 1);
});

test('per-session message capacity preserves prior deduplication records', async t => {
  const lab = await fixture(t, { maxEntries: 1 }); const value = await session(lab); const body = envelope(value);
  const first = await call(lab, HTTP_PATHS.messages, { body, headers: auth(value) });
  const limited = await call(lab, HTTP_PATHS.messages, { body: envelope(value, { messageId: 'message_synthetic_0002' }), headers: auth(value) });
  assert.equal(limited.status, 200); assert.equal(limited.json.status, 'limit');
  const replay = await call(lab, HTTP_PATHS.messages, { body, headers: auth(value) });
  assert.deepEqual(replay.json, first.json); assert.equal(lab.inspect().dispatched, 1);
});

test('content type, encoding, byte limit and invalid JSON fail before session allocation', async t => {
  const lab = await fixture(t);
  const wrongType = await call(lab, HTTP_PATHS.sessions, { headers: { 'Content-Type': 'text/plain' } });
  assert.equal(wrongType.status, 415);
  const encoded = await call(lab, HTTP_PATHS.sessions, { headers: { 'Content-Encoding': 'gzip' } }); assert.equal(encoded.status, 415);
  const large = await call(lab, HTTP_PATHS.sessions, { text: ' '.repeat(8193) }); assert.equal(large.status, 413);
  const malformed = await call(lab, HTTP_PATHS.sessions, { text: '{bad json' }); assert.equal(malformed.status, 400);
  assert.equal(lab.inspect().createdSessions, 0);
  const charset = await call(lab, HTTP_PATHS.sessions, { headers: { 'Content-Type': 'application/json; charset=UTF-8' } });
  assert.equal(charset.status, 201);
});

test('ambiguous framing, missing length and slow bodies cannot reserve a session', async t => {
  const lab = await fixture(t, { bodyTimeoutMs: 40 }); const host = new URL(lab.origin).host;
  const prefix = 'POST ' + HTTP_PATHS.sessions + ' HTTP/1.1\r\nHost: ' + host + '\r\nOrigin: ' + lab.origin + '\r\nContent-Type: application/json\r\nConnection: close\r\n';
  const duplicate = await raw(lab, prefix + 'Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}'); assert.equal(duplicate.status, 400);
  assert.match(duplicate.text, /Referrer-Policy: no-referrer/); assert.match(duplicate.text, /Content-Security-Policy: default-src 'none'/);
  const chunked = await raw(lab, prefix + 'Transfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n'); assert.equal(chunked.status, 400);
  const missing = await raw(lab, prefix + '\r\n'); assert.equal(missing.status, 411);
  const slow = await raw(lab, prefix + 'Content-Length: 20\r\n\r\n{'); assert.equal(slow.status, 408);
  assert.equal(lab.inspect().createdSessions, 0);
});

test('static GET and HEAD use only approved snapshot routes and security headers', async t => {
  const lab = await fixture(t);
  for (const path of ['/', '/index.html', '/http/', '/http/index.html', '/_astro/test.abc.js', '/_astro/test.abc.css']) {
    const result = await call(lab, path, { method: 'GET', text: '', headers: { Origin: null, 'Content-Type': null } });
    assert.equal(result.status, 200, path); assert.equal(result.headers['cache-control'], 'no-store');
    assert.match(result.headers['x-robots-tag'], /noindex/); assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.equal(result.headers['referrer-policy'], 'no-referrer'); assert.match(result.headers['content-security-policy'], /connect-src 'self'/);
    assert.equal(result.headers['access-control-allow-origin'], undefined);
    const head = await call(lab, path, { method: 'HEAD', text: '', headers: { Origin: null } });
    assert.equal(head.status, 200); assert.equal(head.text, ''); assert.equal(head.headers['content-length'], result.headers['content-length']);
  }
  for (const path of ['/../AGENTS.md', '/%2e%2e/AGENTS.md', '/http/?token=synthetic', '/_astro/test.abc.js?x=1', '//index.html', '/ops/faisca/core.mjs']) {
    const result = await call(lab, path, { method: 'GET', text: '' });
    assert.ok([400, 404].includes(result.status), path);
    assert.doesNotMatch(result.text, /# AGENTS|synthetic.*token/);
  }
});

test('static startup refuses symlinks and unapproved files rather than serving repository content', async t => {
  const dir = await staticFixture(t);
  await writeFile(resolve(dir, 'private.txt'), 'PRIVATE_SYNTHETIC_MARKER');
  await assert.rejects(startHttpLab({ enabled: '1', staticDir: dir }), /Unexpected laboratory static file/);
  await rm(resolve(dir, 'private.txt'));
  await symlink(resolve(dir, 'index.html'), resolve(dir, '_astro/link.js'));
  await assert.rejects(startHttpLab({ enabled: '1', staticDir: dir }), /Symlinks/);
});

test('DELETE requires an empty body and disposes the owned session without accepting its token again', async t => {
  const lab = await fixture(t); const value = await session(lab);
  const invalid = await call(lab, HTTP_PATHS.session, { method: 'DELETE', body: { all: true }, headers: auth(value) }); assert.equal(invalid.status, 400);
  assert.equal(lab.inspect().sessions, 1);
  const deleted = await call(lab, HTTP_PATHS.session, { method: 'DELETE', headers: auth(value) });
  assert.equal(deleted.status, 204); assert.equal(deleted.text, ''); assert.equal(lab.inspect().sessions, 0);
  assert.equal((await call(lab, HTTP_PATHS.messages, { body: envelope(value), headers: auth(value) })).status, 401);
});

test('sensitive HTTP input receives local redaction without invoking the provider', async t => {
  const lab = await fixture(t); const value = await session(lab);
  const result = await call(lab, HTTP_PATHS.messages, { body: envelope(value, { input: { type: 'text', text: 'synthetic@example.invalid' } }), headers: auth(value) });
  assert.equal(result.status, 200); assert.equal(result.json.reason, 'sensitive_input');
  assert.equal(result.json.delivery, 'guided_fallback'); assert.doesNotMatch(result.text, /synthetic@example/);
  assert.equal(lab.inspect().dispatched, 0);
});

test('closing the server disposes sessions and connections and can be repeated', async t => {
  const lab = await fixture(t); await session(lab);
  await lab.close(); await lab.close();
  assert.equal(lab.inspect().live, false); assert.equal(lab.inspect().sessions, 0);
  await until(() => lab.inspect().sockets === 0);
});
