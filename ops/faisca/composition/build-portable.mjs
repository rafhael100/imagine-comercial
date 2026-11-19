import { cp, mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sitePages } from '../../../src/data/services.mjs';
import { auditPublicFaiscaDist } from './public-release-gate.mjs';
import { preparePrivateCommercialFaisca } from './commercial-preview.mjs';
import {
  snapshotPortablePublicDist, verifyPortablePublicDist
} from './portable-verify.mjs';

export const PORTABLE_BUILD_SCHEMA = 'faisca.private-comercial-review-package.v1';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const artifactRoot = resolve(root, 'ops/faisca/output/portable');
const commercialDir = resolve(root, 'dist');
const faiscaRoot = resolve(root, 'ops/faisca/output');
const REVIEWED_PNG = '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d';

function singleReplace(data, before, after, description) {
  if (typeof data !== 'string' || data.split(before).length !== 2) {
    throw new Error('R29: unexpected vetted source layout: ' + description);
  }
  return data.replace(before, after);
}

function approvedPublicRoutes() {
  const paths = sitePages.map(item => item.path);
  if (paths.length < 10 || paths.length > 100 || new Set(paths).size !== paths.length ||
      paths.some(p => typeof p !== 'string' || !/^\/(?:[a-z0-9-]+\/)*$/.test(p))) {
    throw new Error('R29: the public site path catalog must be reviewed first.');
  }
  return Object.freeze(paths);
}

export async function buildPortableCommercialReview() {
  if (process.env.IMAGINE_FAISCA_LAB !== '1') {
    throw new Error('R29: explicitly enable local Faísca review with IMAGINE_FAISCA_LAB=1.');
  }
  const publicGate = await auditPublicFaiscaDist({ distDir: commercialDir });
  const approvedLab = await preparePrivateCommercialFaisca({
    commercialDir, faiscaBundleDir: faiscaRoot
  });
  if (approvedLab.approvedMascotSha256 !== REVIEWED_PNG ||
      !publicGate.fileCount && !publicGate.filesChecked) {
    throw new Error('R29: approved Faísca image or public-dist gate does not match.');
  }
  try {
    await lstat(artifactRoot);
    throw new Error('R29: the portable destination already exists; inspect it before replacing files.');
  } catch (e) {
    if (e?.code !== 'ENOENT') throw e;
  }

  // Compile and verify the entire source before copying. Both output trees
  // already passed the bounded allowlists and published-image exclusions.
  const snapshot = await snapshotPortablePublicDist({ directory: commercialDir });
  const files = new Map();
  const vetted = [
    ['private-loopback-preview.mjs', 'src/lib/private-loopback-preview.mjs'],
    ['commercial-preview.mjs', 'ops/faisca/composition/commercial-preview.mjs'],
    ['static-server.mjs', 'ops/faisca/review/static-server.mjs'],
    ['portable-verify.mjs', 'ops/faisca/composition/portable-verify.mjs'],
    ['iniciar-faisca-comercial.mjs', 'ops/faisca/composition/portable-launcher.mjs']
  ];
  for (const [dest, from] of vetted) {
    files.set(dest, await readFile(resolve(root, from), 'utf8'));
  }
  files.set('private-loopback-preview.mjs', singleReplace(
    files.get('private-loopback-preview.mjs'),
    "import {sitePages} from '../data/services.mjs';",
    "import {sitePages} from './site-pages.mjs';", 'private preview catalog'));
  files.set('commercial-preview.mjs', singleReplace(
    singleReplace(files.get('commercial-preview.mjs'),
      "'../review/static-server.mjs'", "'./static-server.mjs'", 'private lab import'),
    "'../../../src/lib/private-loopback-preview.mjs'",
    "'./private-loopback-preview.mjs'", 'commercial site import'));
  const routes = approvedPublicRoutes();
  files.set('site-pages.mjs',
    '/* Canonical public routes captured at reviewed build-time. */\n' +
    'export const sitePages=Object.freeze(' +
    JSON.stringify(routes.map(path => ({ path }))) + '.map(item=>Object.freeze(item)));\n');

  const readme = [
    'IMAGINE COMERCIAL + FAÍSCA — REVISÃO LOCAL, PRIVADA E SEM CHECKOUT',
    '',
    'Requisitos: Node.js 22 ou superior. Não exige npm install nem PHP.',
    'Este pacote foi gerado na CI a partir do HTML Astro Comercial real.',
    'A revisão é simulada: SEM IA generativa externa, CRM, pagamento ou clientes reais.',
    '',
    'Windows / PowerShell:',
    "  $env:IMAGINE_FAISCA_PRIVATE_PASSWORD = Read-Host 'Senha local forte (24+ caracteres)'",
    '  node .\\iniciar-faisca-comercial.mjs --private-review',
    '  Remove-Item Env:\\IMAGINE_FAISCA_PRIVATE_PASSWORD',
    '',
    'Login da janela de autenticação: reviewer',
    'Abra o endereço http://127.0.0.1:<porta>/ mostrado no terminal.',
    'A homepage tem o link e a conversa Faísca embutida, em teste privado.',
    'Ctrl+C encerra o servidor. Ele nunca escuta IP público.',
    '',
    'Verificações feitas antes de abrir a porta:',
    '  - SHA-256 completo dos arquivos Comerciais, registrados no manifesto R29;',
    '  - SHA-256 do bundle Faísca R21, incluindo o PNG original aprovado;',
    '  - lista permitida de rotas e Basic Auth do servidor F154.',
    '',
    'NÃO publicar o ZIP, dist/ nem faisca/ na Internet. NO-GO para produção.',
    'O arquivo R29 SHA-256 não possui assinatura criptográfica: confira',
    'a SHA do GitHub Actions associado ao ZIP antes de confiar na origem.',
    ''
  ].join('\n');

  await mkdir(artifactRoot, { recursive: false });
  await cp(commercialDir, resolve(artifactRoot, 'dist'), { recursive: true });
  await mkdir(resolve(artifactRoot, 'faisca'));
  await cp(resolve(faiscaRoot, 'astro'), resolve(artifactRoot, 'faisca/astro'), { recursive: true });
  await cp(resolve(faiscaRoot, 'Faisca_R21_AUDIT.json'),
    resolve(artifactRoot, 'faisca/Faisca_R21_AUDIT.json'));
  for (const [filename, source] of files) {
    await writeFile(resolve(artifactRoot, filename), source, { mode: 0o600 });
  }
  await writeFile(resolve(artifactRoot, 'Faisca_R29_DIST_SHA256.json'),
    JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600 });
  await writeFile(resolve(artifactRoot, 'LEIA-ME-FAISCA-COMERCIAL.txt'), readme, { mode: 0o600 });

  await verifyPortablePublicDist({
    directory: resolve(artifactRoot, 'dist'),
    manifestPath: resolve(artifactRoot, 'Faisca_R29_DIST_SHA256.json')
  });
  return Object.freeze({
    schema: PORTABLE_BUILD_SCHEMA,
    commercialFileCount: snapshot.fileCount,
    commercialBytes: snapshot.bytes,
    faiscaFileCount: approvedLab.checkedAssetCount,
    approvedMascotSha256: approvedLab.approvedMascotSha256,
    private: true, launchHost: '127.0.0.1',
    publicCheckoutEnabled: false, modelEnabled: false,
    productionPublished: false, operationalEffects: false
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--private-review') {
    throw new Error('Usage: node ops/faisca/composition/build-portable.mjs --private-review');
  }
  const report = await buildPortableCommercialReview();
  process.stdout.write(JSON.stringify(report) + '\n');
}
