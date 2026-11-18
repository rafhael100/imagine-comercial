import { renderDemo } from '../build-demo.mjs';

/** Build-time extraction from the reviewed standalone document; no user input. */
export async function renderLabView({ sourceRoot } = {}) {
  const result = await renderDemo(sourceRoot === undefined ? {} : { sourceRoot });
  const body = result.html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  const css = result.html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1];
  if (typeof body !== 'string' || typeof css !== 'string') throw new Error('Invalid Faísca laboratory template.');
  // Astro performs its own module bundling. Never evaluate the standalone script here.
  const markup = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  if (/<script\b/i.test(markup) || /__FAISCA_[A-Z_]+__/.test(markup)) throw new Error('Unsafe laboratory fragment.');
  return Object.freeze({ markup, css, image_sha256: result.image_sha256, mode: result.mode });
}
