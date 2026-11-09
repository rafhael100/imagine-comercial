/**
 * F14: impede compilar um catálogo que não corresponda EXATAMENTE ao lote
 * aprovado e fixado pela configuração de build de confiança.
 * Este gate NÃO substitui aprovação editorial ou autorização do Portal.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

const RELEASE_ID = /^[a-z][a-z0-9_-]{5,79}$/;
const SHA256 = /^[a-f0-9]{64}$/;
export function payloadSha256(envelope) {
  if (!envelope || typeof envelope.payloadBase64 !== 'string') {
    throw new Error('release pin: signed envelope required');
  }
  return createHash('sha256').update(Buffer.from(envelope.payloadBase64,'base64')).digest('hex');
}
export function enforceReleasePin(snapshot, envelope, { expectedReleaseId, expectedPayloadSha256 }={}) {
  if (!RELEASE_ID.test(expectedReleaseId||'') || !SHA256.test(expectedPayloadSha256||'')) {
    throw new Error('release pin: trusted release ID and SHA-256 are both required');
  }
  if (!snapshot || snapshot.releaseId !== expectedReleaseId) {
    throw new Error('release pin: unexpected release ID');
  }
  const actual = Buffer.from(payloadSha256(envelope),'hex');
  const expected = Buffer.from(expectedPayloadSha256,'hex');
  if (!timingSafeEqual(actual,expected)) {
    throw new Error('release pin: payload digest does not match approved release');
  }
  return snapshot;
}
