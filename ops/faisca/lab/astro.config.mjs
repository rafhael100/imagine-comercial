import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { requireLabMode } from './lab-policy.mjs';

requireLabMode(process.env.IMAGINE_FAISCA_LAB);
const local = (path) => fileURLToPath(new URL(path, import.meta.url));

// Intentionally independent of the root Astro config, public pages and dist.
// Directory settings: https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  root: local('../../..'),
  srcDir: local('./src'),
  publicDir: local('./empty-public'),
  outDir: local('../output/astro'),
  cacheDir: local('../output/astro-cache'),
  output: 'static',
  trailingSlash: 'always',
  prefetch: false,
  server: { host: '127.0.0.1', port: 4329 },
  devToolbar: { enabled: false },
  vite: {
    // This constant is used only by the build-time renderer after bundling.
    define: { 'import.meta.env.FAISCA_LAB_SOURCE_ROOT': JSON.stringify(local('..')) },
    build: { sourcemap: false, modulePreload: false }
  }
});
