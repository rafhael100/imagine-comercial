/**
 * F306 — independently SHA-pinned, offline ordered history package for
 * protected Astro metadata builds and independent package review.
 *
 * The FILE and its EXPECTED DIGEST must be supplied through separate,
 * trusted channels in an actual workflow. This module cannot attest to
 * operator origin, tenant permission or completeness of Portal persistence.
 */
import {createHash,timingSafeEqual} from 'node:crypto';
import {readApprovedFile} from './read-approved-file.mjs';
import {reconstructSignedCatalogCheckpointHistory}
  from './reconstruct-signed-catalog-checkpoint.mjs';

const HOLD='F306: signed checkpoint history not independently verified (HOLD)';
const MAX_TEXT_BYTES=4*1024*1024;
const fields=(value,expected)=>{
  if(value===null||typeof value!=='object'||Array.isArray(value)||
    Object.getPrototypeOf(value)!==Object.prototype)return false;
  const keys=Reflect.ownKeys(value);
  if(keys.length!==expected.length)return false;
  return keys.every(key=>{
    if(typeof key!=='string'||!expected.includes(key))return false;
    const d=Object.getOwnPropertyDescriptor(value,key);
    return d?.enumerable===true&&Object.hasOwn(d,'value');
  });
};
export function getPinnedHistoryInputs(env){
  const path=env?.IMAGINE_CATALOG_HISTORY_FILE;
  const sha=env?.IMAGINE_CATALOG_HISTORY_SHA256;
  if((path===undefined||path==='')&&(sha===undefined||sha===''))return null;
  if(typeof path!=='string'||path.length<1||path.length>2048||
    typeof sha!=='string'||!/^[0-9a-f]{64}$/.test(sha)||
    new Set(sha).size===1)
    throw Error(HOLD);
  // This reader refuses symlinks, malformed UTF-8 and oversized files.
  const text=readApprovedFile(path,MAX_TEXT_BYTES,'signed checkpoint history');
  return Object.freeze({historyText:text,expectedHistorySha256:sha});
}
export function verifyPinnedSignedCatalogHistory({
  historyText,expectedHistorySha256,envelope,trustKeys,pins,
  nowMs=Date.now()
}={}){
  if(typeof historyText!=='string'||
    Buffer.byteLength(historyText,'utf8')>MAX_TEXT_BYTES||
    historyText.length<20||typeof expectedHistorySha256!=='string'||
    !/^[0-9a-f]{64}$/.test(expectedHistorySha256)||
    new Set(expectedHistorySha256).size===1)
    throw Error(HOLD);
  const sha=createHash('sha256').update(historyText,'utf8').digest();
  if(!timingSafeEqual(sha,Buffer.from(expectedHistorySha256,'hex')))
    throw Error(HOLD);
  let bundle;
  try{bundle=JSON.parse(historyText);}catch{throw Error(HOLD);}
  if(!fields(bundle,['schema','releases'])||
    bundle.schema!=='imagine.comercial.signed-history-package.v1')
    throw Error(HOLD);
  const result=reconstructSignedCatalogCheckpointHistory({
    releases:bundle.releases,trustKeys,
    expectedLatestReleaseId:pins?.expectedReleaseId,
    expectedLatestPayloadSha256:pins?.expectedPayloadSha256,
    nowMs
  });
  // A pinned history must contain the SAME selected signed envelope as
  // the independently provided current release, not just equal metadata.
  const last=bundle.releases.at(-1).envelope;
  if(!fields(last,['protocol','keyId','payloadBase64','signatureBase64'])||
    !fields(envelope,['protocol','keyId','payloadBase64','signatureBase64'])||
    ['protocol','keyId','payloadBase64','signatureBase64']
      .some(key=>last[key]!==envelope[key]))
    throw Error(HOLD);
  return result;
}
