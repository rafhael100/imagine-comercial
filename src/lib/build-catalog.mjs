/**
 * F9 — conteúdo público vindo de snapshot assinado, SOMENTE durante o build Astro.
 * Sem HTTP, tokens, preços, checkout ou acesso do visitante à chave de publicação.
 * Versão 1 deliberadamente limitada a slugs já aprovados editorialmente.
 */
import {readApprovedFile} from './read-approved-file.mjs';
import {mergeApprovedServiceMetadata} from './merge-approved-service-metadata.mjs';
import { services as curatedServices } from '../data/services.mjs';
import { verifySignedCatalog } from './verify-signed-catalog.mjs';
import { enforceReleasePin } from './release-pin.mjs';
import { assertBuildReleaseIntent } from './build-release-target.mjs';
import {enforceSignedPublicationTime} from './signed-publication-time.mjs';
import {getPinnedHistoryInputs,verifyPinnedSignedCatalogHistory}
  from './pinned-signed-catalog-history.mjs';

const MAX_ENVELOPE_BYTES = 2 * 1024 * 1024;
const MAX_PUBKEY_BYTES = 16 * 1024;
const KEY_ID = /^[a-z][a-z0-9_-]{4,63}$/;
// F218: pure time gate has no eager Astro catalog side effects.
export {enforceSignedPublicationTime} from './signed-publication-time.mjs';

export {mergeApprovedServiceMetadata} from './merge-approved-service-metadata.mjs';
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
    if(env.IMAGINE_CATALOG_HISTORY_FILE!==undefined&&
      env.IMAGINE_CATALOG_HISTORY_FILE!==''||
      env.IMAGINE_CATALOG_HISTORY_SHA256!==undefined&&
      env.IMAGINE_CATALOG_HISTORY_SHA256!=='')
      throw new Error('F306: signed history requires a selected signed release');
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
  enforceSignedPublicationTime(snapshot.publishedAt,nowMs);
  const inputs=getPinnedHistoryInputs(env);
  if(inputs){
    // A partial signed release is a DELTA, not a complete current catalog.
    // Rebuild cumulative content only from a full, independently SHA-pinned
    // checkpoint chain whose last envelope is the selected release.
    const verified=verifyPinnedSignedCatalogHistory({
      ...inputs,envelope,trustKeys:new Map([[keyId,publicKey]]),
      pins:{expectedReleaseId:releaseId,expectedPayloadSha256:payloadHash},
      nowMs
    });
    return mergeApprovedServiceMetadata(curatedServices,{
      items:verified.effectiveItems
    });
  }
  return mergeApprovedServiceMetadata(curatedServices, snapshot);
}

export const buildServices = loadBuildServices();
