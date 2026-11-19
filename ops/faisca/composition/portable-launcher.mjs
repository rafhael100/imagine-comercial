import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startPrivateCommercialFaisca } from './commercial-preview.mjs';
import { verifyPortablePublicDist } from './portable-verify.mjs';

export const PORTABLE_LAUNCH_SCHEMA = 'faisca.commercial-portable-review.v1';

/** Launches the EXACT files from the extracted review ZIP under Basic Auth.
 * No checkout, network provider, CRM, PHP, or public listen address.
 */
export async function startPortablePrivateReview({ folder, password } = {}) {
  if (typeof folder !== 'string' || typeof password !== 'string' ||
      password.length < 24 || password.length > 128) {
    throw new TypeError('R29: a private ZIP folder and a strong review password are required.');
  }
  const root = resolve(folder);
  const commercialDir = resolve(root, 'dist');
  const faiscaBundleDir = resolve(root, 'faisca');
  await verifyPortablePublicDist({
    directory: commercialDir, manifestPath: resolve(root, 'Faisca_R29_DIST_SHA256.json')
  });
  const server = await startPrivateCommercialFaisca({
    commercialDir, faiscaBundleDir, password, port: 0
  });
  return Object.freeze({
    schema: PORTABLE_LAUNCH_SCHEMA,
    origin: server.origin, productionPublished: false,
    checkoutEnabled: false, externalModelEnabled: false,
    operationalEffects: false, close: server.close
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3 || process.argv[2] !== '--private-review') {
    throw new Error('Use node iniciar-faisca-comercial.mjs --private-review');
  }
  const password = process.env.IMAGINE_FAISCA_PRIVATE_PASSWORD;
  const review = await startPortablePrivateReview({
    folder: dirname(fileURLToPath(import.meta.url)), password
  });
  // Never print the password or include it in any URL, HTML or audit file.
  process.stdout.write([
    'Imagine Comercial + Faísca: REVISÃO LOCAL PRIVADA',
    'Comercial e Faísca: ' + review.origin + '/',
    'Faísca qualificação: ' + review.origin + '/__faisca_preview/journey/',
    'Faísca suporte anônimo: ' + review.origin + '/__faisca_preview/support/',
    'Usuário HTTP: reviewer (a senha foi definida por você no terminal)',
    'Sem pagamento, IA externa, CRM, cliente real ou publicação.',
    'Pressione Ctrl+C para encerrar.'
  ].join('\n') + '\n');
}
