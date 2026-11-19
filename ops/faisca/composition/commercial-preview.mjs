import { readFile, lstat, realpath } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadReviewSnapshot } from '../review/static-server.mjs';
import {
  createPrivateLoopbackPreview, listenPrivateLoopback
} from '../../../src/lib/private-loopback-preview.mjs';

export const COMPOSITE_SCHEMA = 'faisca.commercial-private-composite.v1';
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const accepted = Object.freeze([
  ['journey/index.html', '/__faisca_preview/journey/'],
  ['support/index.html', '/__faisca_preview/support/']
]);

async function realDirectory(path) {
  const root = resolve(path);
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) {
    throw new Error('R24 requires a real, non-symlinked build directory.');
  }
  return root;
}

/**
 * Assemble the current, actually compiled Astro Comercial site and the
 * already audited R22 Faísca bundle on a single authenticated loopback host.
 * Public dist files are never modified, and none of the PHP/API routes are
 * exposed. The only homepage link is added to authenticated HTTP responses.
 */
export async function preparePrivateCommercialFaisca({
  commercialDir = resolve(sourceRoot, 'dist'),
  faiscaBundleDir = resolve(sourceRoot, 'ops', 'faisca', 'output')
} = {}) {
  const dir = await realDirectory(commercialDir);
  const reviewed = await loadReviewSnapshot(faiscaBundleDir);
  const extra = new Map();
  for (const [file, path] of accepted) {
    const bytes = reviewed.memory.get(file);
    if (!bytes) throw new Error('R24 missing an audited Faísca journey.');
    extra.set(path, Buffer.from(bytes));
  }
  for (const [file, bytes] of reviewed.memory) {
    if (!file.startsWith('_astro/')) continue;
    if (!/^_astro\/[A-Za-z0-9._-]+\.(?:js|css)$/.test(file)) {
      throw new Error('R24 received an unreviewed script or stylesheet.');
    }
    // Both Astro builds use '/_astro/'. If they emit the same filename,
    // refusing different bytes avoids silently replacing either application.
    const full = resolve(dir, file);
    try {
      const stat = await lstat(full);
      if (!stat.isFile() || stat.isSymbolicLink() ||
          !(await realpath(full)).startsWith(dir + sep) ||
          !Buffer.from(await readFile(full)).equals(bytes)) {
        throw new Error('R24 Astro asset collision with incompatible bytes.');
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    extra.set('/' + file, Buffer.from(bytes));
  }
  if (extra.size > 48) throw new Error('R24 exceeded the private asset allowlist.');
  return Object.freeze({
    schema: COMPOSITE_SCHEMA,
    commercialDir: dir,
    extra,
    privatePageCount: accepted.length,
    approvedMascotSha256: reviewed.report.approvedMascotSha256,
    checkedAssetCount: reviewed.memory.size,
    noCheckout: true,
    noModel: true,
    noPublicDeploy: true
  });
}

export async function startPrivateCommercialFaisca({
  commercialDir, faiscaBundleDir, password, port = 0
} = {}) {
  if (typeof password !== 'string' || password.length < 24 ||
      !Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new TypeError('R24 needs an operator-only private password and loopback port.');
  }
  const snapshot = await preparePrivateCommercialFaisca({
    ...(commercialDir ? { commercialDir } : {}),
    ...(faiscaBundleDir ? { faiscaBundleDir } : {})
  });
  const server = createPrivateLoopbackPreview({
    directory: snapshot.commercialDir, password,
    faiscaPrivateAssets: snapshot.extra
  });
  const origin = await listenPrivateLoopback(server, port);
  return Object.freeze({
    schema: COMPOSITE_SCHEMA, origin,
    privatePageCount: snapshot.privatePageCount,
    approvedMascotSha256: snapshot.approvedMascotSha256,
    productionPublished: false, checkoutEnabled: false,
    externalModelEnabled: false, operationalEffects: false,
    close: () => new Promise((yes, no) => {
      server.closeAllConnections();
      server.close(error => error ? no(error) : yes());
    })
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--private-review' ||
      process.env.IMAGINE_FAISCA_LAB !== '1') {
    throw new Error('R24 private laboratory must be explicitly enabled.');
  }
  const password = process.env.IMAGINE_FAISCA_PRIVATE_PASSWORD;
  const instance = await startPrivateCommercialFaisca({ password });
  // Never print or persist the password: an operator supplies it privately.
  process.stdout.write([
    'Imagine Comercial + Faísca R24 — LOCAL PRIVATE REVIEW ONLY',
    'Comercial: ' + instance.origin + '/',
    'Faísca vendas: ' + instance.origin + '/__faisca_preview/journey/',
    'Faísca pós-venda anônimo: ' + instance.origin + '/__faisca_preview/support/',
    'No checkout, CRM, AI model, PHP or public deployment. Ctrl+C to stop.'
  ].join('\n') + '\n');
}
