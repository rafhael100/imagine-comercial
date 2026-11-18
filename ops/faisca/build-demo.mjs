import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const cspHash = value => createHash('sha256').update(value).digest('base64');

/** Only trusted checked-in sources are bundled. This is never a runtime compiler. */
export function inlineModule(source, allowedImport) {
  let result = source;
  if (allowedImport) {
    const pattern = new RegExp("^import\\s*\\{[A-Za-z0-9_$,\\s]+\\}\\s*from\\s*['\"]" + allowedImport.replaceAll('.', '\\.') + "['\"];?\\s*", 'm');
    result = result.replace(pattern, '');
  }
  if (/^\s*import\b/m.test(result) || /\bimport\s*\(/.test(result)) {
    throw new Error('Unexpected import in standalone Faísca bundle. Review dependencies.');
  }
  result = result.replace(/^export\s+(?=(?:const|let|function|class)\b)/gm, '');
  if (/^\s*export\b/m.test(result)) throw new Error('Unsupported export in standalone Faísca bundle.');
  return result;
}

/** Render the same reviewed view for standalone output or the isolated Astro lab. */
export async function renderDemo({ assetPath, sourceRoot = root } = {}) {
  // sourceRoot is a trusted build-time path for Astro's relocated server bundle.
  // It is never accepted from the browser or a visitor request.
  const source = resolve(sourceRoot);
  const manifest = JSON.parse(await readFile(resolve(source, 'asset-manifest.json'), 'utf8'));
  const asset = await readFile(assetPath || resolve(source, manifest.file));
  if (asset.length !== manifest.size_bytes || sha256(asset) !== manifest.sha256) {
    throw new Error('Faísca master differs from the approved image. Build refused.');
  }
  if (!asset.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      asset.readUInt32BE(16) !== manifest.width || asset.readUInt32BE(20) !== manifest.height) {
    throw new Error('Invalid approved PNG dimensions. Build refused.');
  }
  const [template, css, knowledge, core, ui] = await Promise.all([
    readFile(resolve(source, 'demo.template.html'), 'utf8'),
    readFile(resolve(source, 'styles.css'), 'utf8'),
    readFile(resolve(source, 'knowledge.mjs'), 'utf8'),
    readFile(resolve(source, 'core.mjs'), 'utf8'),
    readFile(resolve(source, 'ui.mjs'), 'utf8')
  ]);
  const script = ('\n(() => {\n\"use strict\";\n' + inlineModule(knowledge) + '\n' +
    inlineModule(core, './knowledge.mjs') + '\n' + inlineModule(ui, './core.mjs') +
    '\nmountFaisca(document.querySelector("[data-faisca-root]"));\n})();\n')
    .replace(/<\/script/gi, '<\\/script');
  if (/<\/style/i.test(css)) throw new Error('Invalid inline stylesheet.');
  for (const token of ['__FAISCA_IMAGE__', '__FAISCA_CSS__', '__FAISCA_SCRIPT__']) {
    if (template.split(token).length !== 2) throw new Error('Template requires one ' + token);
  }
  let html = template.replace('__FAISCA_IMAGE__', `data:image/png;base64,${asset.toString('base64')}`)
    .replace('__FAISCA_CSS__', css).replace('__FAISCA_SCRIPT__', script);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  if (scripts.length !== 1 || styles.length !== 1) throw new Error('Unexpected script/style count.');
  const policy = `default-src 'none'; img-src data:; style-src 'sha256-${cspHash(styles[0][1])}'; ` +
    `script-src 'sha256-${cspHash(scripts[0][1])}'; connect-src 'none'; font-src 'none'; media-src 'none'; ` +
    `object-src 'none'; base-uri 'none'; form-action 'none'`;
  html = html.replace(/<head>/i, '<head>\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">');
  if (/__FAISCA_[A-Z_]+__/.test(html)) throw new Error('Unresolved build placeholder.');
  return { html, bytes: Buffer.byteLength(html), sha256: sha256(html), image_sha256: manifest.sha256,
    mode: 'guided_demo', release: 'R03', source_branch: null, base_sha: 'c833c12ff34aaeba56549ae5dc41763a6a909b2a' };
}

export async function buildDemo({ out = resolve(root, 'output', 'Faisca_Demonstracao.html'), assetPath } = {}) {
  const { html, ...metadata } = await renderDemo({ assetPath });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html, 'utf8');
  return { path: out, ...metadata };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Usage: node ops/faisca/build-demo.mjs [--out file.html]');
  console.log(JSON.stringify(await buildDemo(args.length ? { out: resolve(args[1]) } : {}), null, 2));
}
