import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, lstat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPORT = 'Faisca_R21_AUDIT.json';
const SCHEMA = 'faisca.static-review-bundle.v1';
const ROUTES = Object.freeze([
  'index.html', 'grounded/index.html', 'http/index.html',
  'journey/index.html', 'journey-http/index.html',
  'journey-http-r08/index.html', 'support/index.html'
]);
const DISABLED_HTTP_ROUTES = new Set([
  '/grounded/', '/http/', '/journey-http/', '/journey-http-r08/'
]);
const MAX_FILES = 64;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const sha = data => createHash('sha256').update(data).digest('hex');
const headers = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin'
});
const reviewedPath = path => ROUTES.includes(path) ||
  /^_astro\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(path);

async function realDirectory(root) {
  const full = resolve(root);
  if (!(await lstat(full)).isDirectory() || await realpath(full) !== full) {
    throw new Error('Review folder must be a real, non-symlinked directory.');
  }
  return full;
}

/** Independent verification of a downloaded review package's manifest.
 * Only exact allowlisted static assets are served, from an in-memory snapshot.
 */
export async function loadReviewSnapshot(rootDir) {
  const root = await realDirectory(rootDir);
  const staticRoot = await realDirectory(resolve(root, 'astro'));
  const report = JSON.parse(await readFile(resolve(root, REPORT), 'utf8'));
  if (report.schema !== SCHEMA || report.scope !== 'offline_private_review_only' ||
      report.productionPublished !== false || report.checkoutEnabled !== false ||
      report.externalModelEnabled !== false || report.operationalEffects !== false ||
      report.pageCount !== ROUTES.length || report.fileCount > MAX_FILES ||
      !Array.isArray(report.routes) || JSON.stringify(report.routes) !== JSON.stringify(ROUTES) ||
      !Array.isArray(report.files) || report.fileCount !== report.files.length) {
    throw new Error('Review manifest does not match the private-only contract.');
  }
  const allowed = new Map();
  for (const entry of report.files) {
    if (!entry || typeof entry.path !== 'string' || !reviewedPath(entry.path) ||
        allowed.has(entry.path) || !Number.isInteger(entry.bytes) || entry.bytes < 1 ||
        entry.bytes > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('Review manifest contains an unapproved entry.');
    }
    allowed.set(entry.path, entry);
  }
  if (ROUTES.some(path => !allowed.has(path))) {
    throw new Error('Review package is missing a required laboratory route.');
  }
  const memory = new Map();
  let total = 0;
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Symlink in private review artifact.');
      const path = prefix + entry.name;
      const absolute = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (prefix || !['_astro', 'grounded', 'http', 'journey', 'journey-http',
          'journey-http-r08', 'support'].includes(entry.name)) {
          throw new Error('Unapproved review directory.');
        }
        await walk(absolute, path + '/');
        continue;
      }
      if (!entry.isFile() || !allowed.has(path) || memory.has(path)) {
        throw new Error('Unexpected file in the review artifact.');
      }
      const file = allowed.get(path);
      const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size !== file.bytes ||
            stat.size > MAX_FILE_BYTES || total + stat.size > MAX_TOTAL_BYTES) {
          throw new Error('Review file size or total limit differs from manifest.');
        }
        bytes = await handle.readFile();
      } finally {
        await handle.close();
      }
      if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) {
        throw new Error('Review artifact digest differs from the manifest.');
      }
      total += bytes.length;
      memory.set(path, bytes);
    }
  }
  await walk(staticRoot);
  if (memory.size !== allowed.size || total !== report.staticBytes) {
    throw new Error('Review artifact differs from its declared static tree.');
  }
  return Object.freeze({ memory, report: Object.freeze(report) });
}

function typeOf(path) {
  return path.endsWith('.html') ? 'text/html; charset=utf-8' :
    path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
}

/** No API, PHP, external connection, login, form, persistence, or public bind. */
export async function startReviewServer({ rootDir, enabled, port = 0 } = {}) {
  if (enabled !== '1' || typeof rootDir !== 'string' ||
      !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new TypeError('Explicit local review and an allowed port are required.');
  }
  const { memory } = await loadReviewSnapshot(rootDir);
  let listeningPort = null;
  const server = createServer((request, response) => {
    const send = (status, text = '', extra = {}) => {
      response.writeHead(status, {
        ...headers, 'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(text), ...extra
      });
      response.end(request.method === 'HEAD' ? undefined : text);
    };
    const hostHeaders = [];
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      if (request.rawHeaders[i].toLowerCase() === 'host') hostHeaders.push(request.rawHeaders[i + 1]);
    }
    if (hostHeaders.length !== 1 || hostHeaders[0] !== '127.0.0.1:' + listeningPort) {
      send(403, 'Private review accepts only its loopback host.'); return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      send(405, 'Review pages are read only.', { Allow: 'GET, HEAD' }); return;
    }
    const path = request.url;
    if (typeof path !== 'string' || path.includes('%') || path.includes('?') ||
        path.includes('#') || path.includes('\\') || path.includes('//')) {
      send(400, 'Malformed review request.'); return;
    }
    if (DISABLED_HTTP_ROUTES.has(path)) {
      send(404, 'This route needs a separate private PHP laboratory.'); return;
    }
    const file = path === '/' ? 'index.html' :
      path === '/journey/' ? 'journey/index.html' :
      path === '/support/' ? 'support/index.html' :
      /^\/_astro\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(path) ? path.slice(1) : null;
    if (!file || !memory.has(file)) {
      send(404, 'Not found in the offline review.'); return;
    }
    const bytes = memory.get(file);
    response.writeHead(200, {
      ...headers, 'Content-Type': typeOf(file), 'Content-Length': bytes.length
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  await new Promise((yes, no) => {
    server.once('error', no);
    server.listen(port, '127.0.0.1', () => { server.off('error', no); yes(); });
  });
  listeningPort = server.address().port;
  return Object.freeze({
    origin: 'http://127.0.0.1:' + listeningPort,
    mode: 'local_static_only',
    close: () => new Promise((resolveClose, rejectClose) => {
      server.closeAllConnections();
      server.close(error => error ? rejectClose(error) : resolveClose());
    })
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--private-review') {
    throw new Error('Usage: node faisca-review-server.mjs --private-review');
  }
  const instance = await startReviewServer({
    rootDir: dirname(fileURLToPath(import.meta.url)),
    enabled: '1', port: 0
  });
  process.stdout.write([
    'FAÍSCA — revisão local, sem publicação ou PHP',
    'Jornada comercial: ' + instance.origin + '/journey/',
    'Triagem de pós-venda: ' + instance.origin + '/support/',
    'Demonstração inicial: ' + instance.origin + '/',
    'R08/R20 local é simulado; verificação PHP real exige laboratório próprio.',
    'Pressione Ctrl+C para encerrar.'
  ].join('\n') + '\n');
}
