/**
 * F9 — conteúdo público vindo de snapshot assinado, SOMENTE durante o build Astro.
 * Sem HTTP, tokens, preços, checkout ou acesso do visitante à chave de publicação.
 * Versão 1 deliberadamente limitada a slugs já aprovados editorialmente.
 */
import { openSync, fstatSync, readSync, closeSync, constants } from 'node:fs';
import { TextDecoder } from 'node:util';
import { services as curatedServices } from '../data/services.mjs';
import { verifySignedCatalog } from './verify-signed-catalog.mjs';
import { enforceReleasePin } from './release-pin.mjs';
import { assertBuildReleaseIntent } from './build-release-target.mjs';

const MAX_ENVELOPE_BYTES = 2 * 1024 * 1024;
const MAX_PUBKEY_BYTES = 16 * 1024;
const KEY_ID = /^[a-z][a-z0-9_-]{4,63}$/;
// F201: a signed future-dated publication must not become public early.
// Five minutes covers small operator/runner clock skew, never a scheduled
// release. A signature authenticates bytes, not editorial go-live timing.
const MAX_CLOCK_SKEW_MS=5*60*1000;

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
  const merged=curated.map(base => {
    const next = overrides.get(base.slug);
    if (!next) return base;
    // Não sobrescrever slug, FAQ, links, descrição institucional ou preços.
    // A descrição publicada também fica visível no texto principal da página.
    return Object.freeze({
      ...base, title: next.title, description: next.description,
      intro: next.description
    });
  });
  // F198: a partially signed update must not silently duplicate SEO titles
  // or meta descriptions already present on any unchanged public page.
  // Compare the FINAL six-page catalog, not only the signed delta.
  const titles=new Set(),descriptions=new Set();
  for(const item of merged){
    if(typeof item.title!=='string'||typeof item.description!=='string')
      throw Error('build catalog: invalid public SEO metadata');
    const title=item.title.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
    const description=item.description.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
    if(titles.has(title))throw Error('build catalog: duplicate public title');
    if(descriptions.has(description))
      throw Error('build catalog: duplicate public description');
    titles.add(title);
    descriptions.add(description);
  }
  return Object.freeze(merged);
}

function readApprovedFile(path, maxBytes, label) {
  if (typeof path !== 'string' || path.length < 1 || path.includes('\0')) {
    throw new Error('build catalog: invalid ' + label + ' path');
  }
  // F194: one descriptor for check and read; no symlink at final path.
  // A concurrent replacement of path cannot change the opened inode.
  let fd;
  try {
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size>maxBytes)throw Error('unsafe');
    const chunks=[];
    let total=0;
    while(true){
      const chunk=Buffer.allocUnsafe(Math.min(65536,maxBytes-total+1));
      const bytes=readSync(fd,chunk,0,chunk.length,null);
      if(bytes===0)break;
      total+=bytes;
      if(total>maxBytes)throw Error('oversize');
      chunks.push(chunk.subarray(0,bytes));
    }
    return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true})
      .decode(Buffer.concat(chunks,total));
  }catch{
    // Error messages must not reveal paths, payload content or key material.
    throw new Error('build catalog: unsafe ' + label + ' file');
  }finally{
    if(fd!==undefined)closeSync(fd);
  }
}

export function loadBuildServices(env = process.env, nowMs=Date.now()) {
  // A target declarado como staging/production nunca usa fallback editorial
  // nem pode ser interpretado como autorização de publicação.
  const intent=assertBuildReleaseIntent(env);
  const envelopePath = env.IMAGINE_CATALOG_ENVELOPE_FILE;
  const keyPath = env.IMAGINE_CATALOG_PUBLIC_KEY_FILE;
  const keyId = env.IMAGINE_CATALOG_TRUSTED_KEY_ID;
  const releaseId = env.IMAGINE_CATALOG_EXPECTED_RELEASE_ID;
  const payloadHash = env.IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256;
  const provided = [envelopePath, keyPath, keyId, releaseId, payloadHash]
    .filter(x => x !== undefined && x !== '');
  if (provided.length === 0) {
    if (intent.signedRequired) {
      throw new Error('build catalog: signed catalog required; refusing curated fallback');
    }
    return curatedServices;
  }
  if (provided.length !== 5 || !KEY_ID.test(keyId)) {
    throw new Error('build catalog: envelope, public key, key ID, release ID and SHA-256 required together');
  }
  // Conteúdo e chave pública injetados SOMENTE por ambiente de build autorizado.
  const envelope = JSON.parse(readApprovedFile(envelopePath, MAX_ENVELOPE_BYTES, 'envelope'));
  const publicKey = readApprovedFile(keyPath, MAX_PUBKEY_BYTES, 'public key');
  const snapshot = verifySignedCatalog(envelope, new Map([[keyId, publicKey]]));
  if (envelope.keyId !== keyId) throw new Error('build catalog: key ID mismatch');
  enforceReleasePin(snapshot, envelope, {
    expectedReleaseId: releaseId, expectedPayloadSha256: payloadHash
  });
  if(!Number.isSafeInteger(nowMs)||nowMs<1)
    throw new Error('build catalog: invalid verification time');
  const signedPublicationMs=Date.parse(snapshot.publishedAt);
  if(!Number.isFinite(signedPublicationMs)||
      signedPublicationMs-nowMs>MAX_CLOCK_SKEW_MS)
    throw new Error('build catalog: signed publication is in the future');
  return mergeApprovedServiceMetadata(curatedServices, snapshot);
}

export const buildServices = loadBuildServices();
