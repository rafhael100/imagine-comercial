import { cp, mkdir, lstat, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditPublicFaiscaDist } from '../composition/public-release-gate.mjs';
import { preparePrivateCommercialFaisca } from '../composition/commercial-preview.mjs';
import { renderPrivateFaiscaHome } from '../../../src/lib/private-loopback-preview.mjs';
import { STAGING_KIT_SCHEMA, snapshotPrivateStagingFiles, verifyPrivateStagingKit } from './verify-kit.mjs';

export const STAGING_BUILD_SCHEMA = 'faisca.private-staging-build-review.v1';
const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '..', '..', '..');
const publicDir = resolve(project, 'dist');
const outputDir = resolve(project, 'ops/faisca/output/private-staging-kit');

function staticRoutePath(path) {
  if (path === '/__faisca_preview/journey/' ||
      path === '/__faisca_preview/support/') return path.slice(1) + 'index.html';
  if (path === '/__faisca_preview/quote-bridge.js' ||
      /^\/_astro\/[A-Za-z0-9._-]+\.(?:js|css)$/.test(path)) return path.slice(1);
  throw new Error('R38: unexpected private route during static staging assembly.');
}

export async function buildPrivateStagingKit() {
  if (process.env.IMAGINE_FAISCA_LAB !== '1') {
    throw new Error('R38: review mode must be explicitly enabled.');
  }
  // R26 must pass BEFORE copying any build into the operator review package.
  const publicGate = await auditPublicFaiscaDist({ distDir: publicDir });
  const prepared = await preparePrivateCommercialFaisca({
    commercialDir: publicDir, faiscaBundleDir: resolve(project, 'ops/faisca/output')
  });
  if (!publicGate || publicGate.privateFaiscaAssetsDetected !== false ||
      prepared.approvedMascotSha256 !==
      '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d' ||
      prepared.extra.size < 4 || !prepared.extra.has('/__faisca_preview/quote-bridge.js')) {
    throw new Error('R38: public leak gate or approved private asset checks failed.');
  }
  try {
    await lstat(outputDir);
    throw new Error('R38: staging review output exists; inspect it instead of overwriting.');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const site = resolve(outputDir, 'site');
  await mkdir(outputDir, { recursive: false });
  await cp(publicDir, site, { recursive: true, errorOnExist: true });
  // Apply the private heading only to the DUPLICATE. The public dist remains
  // byte-identical and must never receive a Faísca script or preview route.
  const home = await readFile(resolve(site, 'index.html'), 'utf8');
  await writeFile(resolve(site, 'index.html'), renderPrivateFaiscaHome(home), { mode: 0o600 });
  for (const [url, bytes] of prepared.extra) {
    const relative = staticRoutePath(url);
    const target = resolve(site, relative);
    if (!target.startsWith(site + sep) || !Buffer.isBuffer(bytes)) {
      throw new Error('R38: unsafe private asset destination.');
    }
    await mkdir(dirname(target), { recursive: true });
    try {
      const stat = await lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() ||
          !Buffer.from(await readFile(target)).equals(bytes)) {
        throw new Error('R38: public/private Astro asset collision.');
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await writeFile(target, bytes, { mode: 0o600 });
    }
  }

  await mkdir(resolve(outputDir, 'ops/staging'), { recursive: true });
  await cp(resolve(here, 'compose.yaml'), resolve(outputDir,'ops/staging/compose.yaml'));
  await cp(resolve(here, 'nginx.conf'), resolve(outputDir,'ops/staging/nginx.conf'));
  await cp(resolve(here, 'verify-kit.mjs'), resolve(outputDir,'verify-kit.mjs'));
  const readme = [
    'FAÍSCA R38 — REVIEW-ONLY PRIVATE STATIC STAGING KIT',
    '',
    'This is NOT a production release or an instruction to deploy.',
    'The site includes Comercial Astro + private R08 Faísca qualification.',
    'It contains NO secrets, customer data, checkout, model, PHP or CRM.',
    'Its IP/port are ONLY 127.0.0.1:4337 when an authorized operator',
    'later starts a reviewed container using a separately supplied',
    'digest-pinned Nginx unprivileged image and private bcrypt htpasswd.',
    '',
    'Before any operator action, verify integrity in this directory:',
    '  node verify-kit.mjs --verify',
    '',
    'Review source sha and this kit manifest through GitHub CI.',
    'Configure a reviewed Nginx image by verified digest, NOT latest/tag.',
    'Provide IMAGINE_FAISCA_STAGING_SITE_DIR as an absolute private path.',
    'Provide IMAGINE_FAISCA_STAGING_HTPASSWD_PATH with bcrypt, unreadable',
    'to other users and OUTSIDE this folder/repository/artifact.',
    'Require SSH tunnel, MFA, access audit and independent operator GO.',
    '',
    'Do not run docker compose up as a result of downloading this kit.',
    'Always separately inspect Docker interpolated configuration',
    'and Nginx effective policy before allowing access from a machine.',
    'Do not expose port 4337 to a public interface or connect DNS.',
    '',
    'Even in private staging, this is synthetic: no AI vendor,',
    'no authenticated Portal/CRM, no orders, no payments and no leads.',
    ''
  ].join('\n');
  await writeFile(resolve(outputDir,'LEIA-ME-FAISCA-R38.txt'), readme, { mode: 0o600 });
  const snapshot = await snapshotPrivateStagingFiles({ kitDir: outputDir });
  const manifest = Object.freeze({
    schema: STAGING_KIT_SCHEMA, status: 'REVIEW_ONLY_NO_DEPLOY',
    approvedMascotSha256: prepared.approvedMascotSha256,
    sourcePublicFilesChecked: publicGate.filesChecked,
    privatePagesAdded: prepared.privatePageCount,
    publicFaiscaEnabled: false, productionPublished: false,
    checkoutEnabled: false, externalModelEnabled: false,
    operationalEffects: false,
    fileCount: snapshot.files.length, totalBytes: snapshot.totalBytes,
    files: snapshot.files
  });
  await writeFile(resolve(outputDir, 'Faisca_R38_MANIFEST.json'),
    JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  await verifyPrivateStagingKit({ kitDir: outputDir });
  return Object.freeze({
    schema: STAGING_BUILD_SCHEMA,
    fileCount: snapshot.files.length, totalBytes: snapshot.totalBytes,
    privatePagesAdded: prepared.privatePageCount, approvedMascotSha256: prepared.approvedMascotSha256,
    stagingDeployed: false, productionPublished: false, operationalEffects: false
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--review-only') {
    throw new Error('Usage: node ops/faisca/staging/build-kit.mjs --review-only');
  }
  const result = await buildPrivateStagingKit();
  process.stdout.write(JSON.stringify(result) + '\n');
}
