/**
 * F9 — conteúdo público vindo de snapshot assinado, SOMENTE durante o build Astro.
 * Sem HTTP, tokens, preços, checkout ou acesso do visitante à chave de publicação.
 * Versão 1 deliberadamente limitada a slugs já aprovados editorialmente.
 */
import { readFileSync, lstatSync } from 'node:fs';
import { services as curatedServices } from '../data/services.mjs';
import { verifySignedCatalog } from './verify-signed-catalog.mjs';

const MAX_ENVELOPE_BYTES = 2 * 1024 * 1024;
const MAX_PUBKEY_BYTES = 16 * 1024;
const KEY_ID = /^[a-z][a-z0-9_-]{4,63}$/;

export function mergeApprovedServiceMetadata(curated, snapshot) {
  if (!Array.isArray(curated) || !snapshot || !Array.isArray(snapshot.items)) {
    throw new Error('build catalog: validated snapshot and curated services required');
  }
  const known = new Map(curated.map(service => [service.slug, service]));
  const overrides = new Map();
  for (const item of snapshot.items) {
    const base = known.get(item.slug);
    if (!base) throw new Error('build catalog: unpublished editorial slug: ' + item.slug);
    if (overrides.has(item.slug)) throw new Error('build catalog: duplicate slug: ' + item.slug);
    if (item.path !== '/servicos/' + base.slug + '/') {
      throw new Error('build catalog: invalid approved path');
    }
    overrides.set(item.slug, item);
  }
  return Object.freeze(curated.map(base => {
    const next = overrides.get(base.slug);
    if (!next) return base;
    // Não sobrescrever slug, FAQ, links, descrição institucional ou preços.
    // A descrição publicada também fica visível no texto principal da página.
    return Object.freeze({
      ...base, title: next.title, description: next.description,
      intro: next.description
    });
  }));
}

function readApprovedFile(path, maxBytes, label) {
  if (typeof path !== 'string' || path.length < 1 || path.includes('\0')) {
    throw new Error('build catalog: invalid ' + label + ' path');
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
    throw new Error('build catalog: unsafe ' + label + ' file');
  }
  return readFileSync(path, 'utf8');
}

export function loadBuildServices(env = process.env) {
  const envelopePath = env.IMAGINE_CATALOG_ENVELOPE_FILE;
  const keyPath = env.IMAGINE_CATALOG_PUBLIC_KEY_FILE;
  const keyId = env.IMAGINE_CATALOG_TRUSTED_KEY_ID;
  const provided = [envelopePath, keyPath, keyId].filter(x => x !== undefined && x !== '');
  if (provided.length === 0) return curatedServices;
  if (provided.length !== 3 || !KEY_ID.test(keyId)) {
    throw new Error('build catalog: signed envelope, public key and key ID required together');
  }
  // Conteúdo e chave pública injetados SOMENTE por ambiente de build autorizado.
  const envelope = JSON.parse(readApprovedFile(envelopePath, MAX_ENVELOPE_BYTES, 'envelope'));
  const publicKey = readApprovedFile(keyPath, MAX_PUBKEY_BYTES, 'public key');
  const snapshot = verifySignedCatalog(envelope, new Map([[keyId, publicKey]]));
  if (envelope.keyId !== keyId) throw new Error('build catalog: key ID mismatch');
  return mergeApprovedServiceMetadata(curatedServices, snapshot);
}

export const buildServices = loadBuildServices();
