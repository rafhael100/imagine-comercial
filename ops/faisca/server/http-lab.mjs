import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readdir, lstat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConversationRuntime } from '../conversation-runtime.mjs';
import { validateConversationRequest } from '../conversation-contract.mjs';
import { createSimulatedProvider } from '../simulated-provider.mjs';
import { HTTP_SESSION_SCHEMA, HTTP_ERROR_SCHEMA, HTTP_CONTEXT, HTTP_PATHS, createHttpResult } from '../http-contract.mjs';

const defaultStaticDir = resolve(dirname(fileURLToPath(import.meta.url)), '../output/astro');
const MAX_BODY_BYTES = 8192;
const securityHeaders = Object.freeze({
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data:; style-src 'self' 'unsafe-inline'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
});
const sha256 = text => createHash('sha256').update(text).digest('hex');
const integerIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const emptyObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;

class HttpLabError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

async function loadStaticFiles(staticDir) {
  const root = resolve(staticDir);
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) throw new Error('Laboratory static directory must be a real directory.');
  const files = new Map(); let total = 0;
  async function collect(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Symlinks are forbidden in laboratory static files.');
      if (entry.isDirectory()) {
        if (prefix || !['_astro', 'http', 'grounded', 'journey'].includes(entry.name)) throw new Error('Unexpected laboratory static directory.');
        await collect(resolve(directory, entry.name), path + '/');
        continue;
      }
      if (!entry.isFile() || !(path === 'index.html' || path === 'http/index.html' || path === 'grounded/index.html' || path === 'journey/index.html' || /^_astro\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(path))) {
        throw new Error('Unexpected laboratory static file.');
      }
      const handle = await open(resolve(directory, entry.name), constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > 8 * 1024 * 1024 || files.size >= 128 || total + stat.size > 16 * 1024 * 1024) {
          throw new Error('Laboratory static files exceed the bounded snapshot.');
        }
        bytes = await handle.readFile();
        if (bytes.length !== stat.size) throw new Error('Laboratory static file changed during startup.');
      } finally { await handle.close(); }
      total += bytes.length;
      files.set('/' + path, bytes);
    }
  }
  await collect(root);
  if (!files.has('/index.html')) throw new Error('Build the separate Astro laboratory before starting HTTP.');
  return files;
}

function rawHeaders(request) {
  const headers = new Map();
  if (request.rawHeaders.length > 128) throw new HttpLabError(400, 'invalid_headers');
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index].toLowerCase();
    if (headers.has(name)) throw new HttpLabError(400, 'invalid_headers');
    headers.set(name, request.rawHeaders[index + 1]);
  }
  if (headers.has('transfer-encoding') || headers.has('trailer') || headers.has('te') || headers.has('expect')) {
    throw new HttpLabError(400, 'invalid_framing');
  }
  return headers;
}

function bodyLength(headers) {
  if (headers.has('content-encoding')) throw new HttpLabError(415, 'unsupported_encoding');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers.get('content-type') || '')) {
    throw new HttpLabError(415, 'invalid_content_type');
  }
  const value = headers.get('content-length');
  if (value === undefined) throw new HttpLabError(411, 'invalid_framing');
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new HttpLabError(400, 'invalid_framing');
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes > MAX_BODY_BYTES) throw new HttpLabError(413, 'body_too_large');
  return bytes;
}

function readJson(request, expectedLength, timeoutMs) {
  return new Promise((resolveBody, rejectBody) => {
    let finished = false; let count = 0; const chunks = [];
    const finish = (error, value) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      request.removeListener('data', onData); request.removeListener('end', onEnd);
      request.removeListener('aborted', onAbort); request.removeListener('error', onAbort);
      if (error) { request.resume(); rejectBody(error); } else resolveBody(value);
    };
    const onData = chunk => {
      count += chunk.length;
      if (count > MAX_BODY_BYTES || count > expectedLength) { finish(new HttpLabError(413, 'body_too_large')); return; }
      chunks.push(chunk);
    };
    const onEnd = () => {
      if (count !== expectedLength) { finish(new HttpLabError(400, 'invalid_framing')); return; }
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, count));
        finish(null, JSON.parse(text));
      } catch { finish(new HttpLabError(400, 'invalid_json')); }
    };
    const onAbort = () => finish(new HttpLabError(400, 'invalid_framing'));
    const timer = setTimeout(() => finish(new HttpLabError(408, 'body_timeout')), timeoutMs);
    request.on('data', onData); request.once('end', onEnd);
    request.once('aborted', onAbort); request.once('error', onAbort);
  });
}

/** Real HTTP exclusively on loopback. Every provider and business effect is simulated. */
export async function startHttpLab({ enabled, port = 0, staticDir = defaultStaticDir, scenario = 'success',
  timeoutMs = 250, delayMs = 40, maxSessions = 8, sessionTtlMs = 300000, maxEntries = 64,
  bodyTimeoutMs = 1000, now = Date.now, createProvider, prepareTurn = undefined, prepareTurnFactory } = {}) {
  if (enabled !== '1') throw new Error('IMAGINE_FAISCA_HTTP_LAB=1 is required for the isolated HTTP laboratory.');
  if (!integerIn(port, 0, 65535) || !integerIn(maxSessions, 1, 32) || !integerIn(sessionTtlMs, 50, 3600000) ||
      !integerIn(bodyTimeoutMs, 10, 10000) || typeof staticDir !== 'string' || typeof now !== 'function' ||
      (createProvider !== undefined && typeof createProvider !== 'function') ||
      (prepareTurn !== undefined && typeof prepareTurn !== 'function') ||
      (prepareTurnFactory !== undefined && typeof prepareTurnFactory !== 'function') ||
      (prepareTurnFactory !== undefined && prepareTurn !== undefined)) throw new TypeError('Invalid HTTP laboratory configuration.');
  // Validate the per-session policy factory before listening. Each HTTP session
  // receives a fresh R07 state closure; a neighboring token cannot share it.
  const probePrepareTurn = prepareTurnFactory ? prepareTurnFactory('faisca-probe-session') : (prepareTurn ?? undefined);
  if (probePrepareTurn !== undefined && typeof probePrepareTurn !== 'function') throw new TypeError('Invalid session conversation policy.');
  const probe = createConversationRuntime({ provider: createSimulatedProvider({ scenario, delayMs }), timeoutMs, maxEntries,
    ...(probePrepareTurn ? { prepareTurn: probePrepareTurn } : {}) });
  probe.destroy();
  const clock = () => { const value = now(); if (!Number.isFinite(value) || value < 0) throw new Error('Invalid laboratory clock.'); return value; };
  clock();
  const files = await loadStaticFiles(staticDir);
  const sessions = new Map(); const sockets = new Set();
  const counters = { createdSessions: 0, expiredSessions: 0, retiredDispatched: 0, messages: 0, reconciliations: 0 };
  let origin; let expectedHost; let live = true; let inflight = 0; let closing;

  function disposeSession(key, expired = false) {
    const session = sessions.get(key); if (!session) return;
    counters.retiredDispatched += session.runtime.inspect().dispatched;
    session.runtime.destroy(); sessions.delete(key);
    if (expired) counters.expiredSessions++;
  }
  function sweep() {
    const time = clock();
    for (const [key, session] of sessions) if (session.expiresAt <= time) disposeSession(key, true);
  }
  function authorize(headers) {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(headers.get('authorization') || '');
    if (!match) throw new HttpLabError(401, 'unauthorized');
    sweep();
    const key = sha256(match[1]); const session = sessions.get(key);
    if (!session) throw new HttpLabError(401, 'unauthorized');
    return { key, session };
  }
  function json(response, status, value) {
    if (response.destroyed || response.writableEnded) return;
    const body = status === 204 ? '' : JSON.stringify(value);
    response.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body), ...(status >= 400 ? { Connection: 'close' } : {}) });
    response.end(body);
  }
  const errorResponse = (response, status, code) => json(response, status, { schema: HTTP_ERROR_SCHEMA, code });

  async function handle(request, response) {
    if (!live) throw new HttpLabError(503, 'server_closed');
    const headers = rawHeaders(request);
    if (headers.get('host') !== expectedHost) throw new HttpLabError(400, 'invalid_host');
    const path = request.url;
    if (typeof path !== 'string' || !path.startsWith('/') || /[?%#\\]/.test(path) || path.includes('//') ||
        path.split('/').some(part => part === '.' || part === '..')) throw new HttpLabError(400, 'invalid_path');
    const api = Object.values(HTTP_PATHS).includes(path);
    if (!api) {
      if (!['GET', 'HEAD'].includes(request.method)) throw new HttpLabError(405, 'method_not_allowed');
      if (headers.has('content-length') && headers.get('content-length') !== '0') throw new HttpLabError(400, 'invalid_framing');
      const canonical = path === '/' ? '/index.html' : path === '/http/' ? '/http/index.html'
        : path === '/grounded/' ? '/grounded/index.html' : path === '/journey/' ? '/journey/index.html' : path;
      const body = files.get(canonical);
      if (!body) throw new HttpLabError(404, 'not_found');
      response.writeHead(200, { ...securityHeaders, 'Content-Length': body.length,
        'Content-Type': canonical.endsWith('.js') ? 'text/javascript; charset=utf-8' : canonical.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : body); return;
    }
    if (headers.get('origin') !== origin) throw new HttpLabError(403, 'invalid_origin');
    const expectedMethod = path === HTTP_PATHS.session ? 'DELETE' : 'POST';
    if (request.method !== expectedMethod) throw new HttpLabError(405, 'method_not_allowed');
    const length = bodyLength(headers);
    // Early authentication avoids processing even a bounded body for bad tokens.
    if (path !== HTTP_PATHS.sessions) authorize(headers);
    else if (headers.has('authorization')) throw new HttpLabError(400, 'invalid_headers');
    const body = await readJson(request, length, bodyTimeoutMs);
    if (!live) throw new HttpLabError(503, 'server_closed');
    sweep();
    if (path === HTTP_PATHS.sessions) {
      if (!emptyObject(body)) throw new HttpLabError(400, 'invalid_request');
      if (sessions.size >= maxSessions) throw new HttpLabError(429, 'session_capacity');
      const token = randomBytes(32).toString('hex'); const conversationId = randomBytes(16).toString('hex');
      const sessionPrepareTurn = prepareTurnFactory ? prepareTurnFactory(conversationId) : (prepareTurn ?? undefined);
      if (sessionPrepareTurn !== undefined && typeof sessionPrepareTurn !== 'function') throw new Error('Invalid session conversation policy.');
      const provider = createProvider ? createProvider() : createSimulatedProvider({ scenario, delayMs });
      const runtime = createConversationRuntime({ provider, timeoutMs, maxEntries,
        ...(sessionPrepareTurn ? { prepareTurn: sessionPrepareTurn } : {}) });
      sessions.set(sha256(token), { conversationId, runtime, expiresAt: clock() + sessionTtlMs });
      counters.createdSessions++;
      json(response, 201, { schema: HTTP_SESSION_SCHEMA, conversationId, token, expiresInMs: sessionTtlMs, context: HTTP_CONTEXT });
      return;
    }
    // Body receipt may cross the TTL; authorization is rechecked before use.
    const { key, session } = authorize(headers);
    if (path === HTTP_PATHS.session) {
      if (!emptyObject(body)) throw new HttpLabError(400, 'invalid_request');
      disposeSession(key); json(response, 204); return;
    }
    const envelope = validateConversationRequest(body);
    if (!envelope) throw new HttpLabError(400, 'invalid_request');
    if (envelope.conversationId !== session.conversationId) throw new HttpLabError(403, 'conversation_mismatch');
    if (path === HTTP_PATHS.messages) counters.messages++; else counters.reconciliations++;
    // Socket closure is not provider cancellation. Runtime deduplication and
    // reconciliation remain available to this session after a client disconnect.
    const result = path === HTTP_PATHS.messages ? await session.runtime.send(envelope) : await session.runtime.reconcile(envelope);
    // TTL or explicit deletion may change while the provider is working.
    // A valid token at dispatch does not authorize a later delivery forever.
    authorize(headers);
    json(response, 200, createHttpResult(envelope, result));
  }

  const server = createServer({ maxHeaderSize: 16384, headersTimeout: 5000, requestTimeout: 15000 }, (request, response) => {
    inflight++;
    handle(request, response).catch(error => {
      request.resume();
      errorResponse(response, error instanceof HttpLabError ? error.status : 500, error instanceof HttpLabError ? error.code : 'internal_error');
    }).finally(() => { inflight--; });
  });
  server.maxConnections = 32;
  server.keepAliveTimeout = 1000;
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('checkContinue', (request, response) => { request.resume(); errorResponse(response, 400, 'invalid_framing'); });
  server.on('checkExpectation', (request, response) => { request.resume(); errorResponse(response, 400, 'invalid_framing'); });
  server.on('clientError', (_error, socket) => {
    if (!socket.writable || socket.destroyed || socket.writableEnded) return;
    const body = JSON.stringify({ schema: HTTP_ERROR_SCHEMA, code: 'invalid_framing' });
    const policy = Object.entries(securityHeaders).map(([name, value]) => name + ': ' + value).join('\r\n');
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Type: application/json\r\n' + policy + '\r\nContent-Length: ' + Buffer.byteLength(body) + '\r\n\r\n' + body);
  });
  await new Promise((resolveListen, rejectListen) => { server.once('error', rejectListen); server.listen(port, '127.0.0.1', resolveListen); });
  const address = new URL('http://127.0.0.1:' + server.address().port);
  origin = address.origin; expectedHost = address.host;
  const sweepTimer = setInterval(() => { try { sweep(); } catch { /* Trusted clock faults do not expose session data. */ } }, Math.min(1000, sessionTtlMs));
  sweepTimer.unref();
  function close() {
    if (closing) return closing;
    live = false; clearInterval(sweepTimer);
    for (const key of sessions.keys()) disposeSession(key);
    closing = new Promise(resolveClose => {
      server.close(() => resolveClose());
      for (const socket of sockets) socket.destroy();
    });
    return closing;
  }
  const inspect = () => Object.freeze({ live, sessions: sessions.size, sockets: sockets.size, inflight,
    createdSessions: counters.createdSessions, expiredSessions: counters.expiredSessions,
    dispatched: counters.retiredDispatched + [...sessions.values()].reduce((total, session) => total + session.runtime.inspect().dispatched, 0),
    messages: counters.messages, reconciliations: counters.reconciliations });
  return Object.freeze({ origin, close, inspect });
}
