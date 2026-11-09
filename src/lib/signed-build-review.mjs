/**
 * F24 — ligação criptográfica de lote assinado ao HTML compilado de laboratório.
 * A assinatura autentica bytes de catálogo perante chaves de teste; o relatório
 * NÃO prova grants, sessão, MFA, consentimento ou autorização de deployment.
 */
import assert from 'node:assert/strict';
import {verifySignedCatalog} from './verify-signed-catalog.mjs';
import {enforceReleasePin, payloadSha256} from './release-pin.mjs';
import {createReleaseReview} from './release-review.mjs';
import {verifyIndexablePage} from './seo-output-contract.mjs';
import {sitePages, toAbsoluteUrl} from '../data/services.mjs';

const allowedSlugs=new Set(sitePages
  .map(page=>page.path.match(/^\/servicos\/([a-z0-9-]+)\/$/)?.[1])
  .filter(Boolean));

function decodeHtmlText(text) {
  return text.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([0-9a-f]+));/gi,
    (original,decimal,hex) => {
      const codes={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
      const key=original.slice(1,-1).toLowerCase();
      if(codes[key])return codes[key];
      const num=hex?parseInt(hex,16):Number(decimal);
      return Number.isInteger(num) && num>=0 && num<=0x10ffff
        && !(num>=0xd800 && num<=0xdfff)
        ? String.fromCodePoint(num) : original;
    });
}
function singleCaptured(html, regex, label) {
  const matches=[...html.matchAll(regex)];
  assert.equal(matches.length,1,'signed build: expected one '+label);
  return decodeHtmlText(matches[0][1]);
}

/**
 * Collects a REVIEW_ONLY record tied to both a valid catalog signature/pin
 * and the bytes of the real Astro output. No persistent replay protection.
 */
export function createSignedBuildReview(files, envelope, trustKeys, pins) {
  const snapshot=verifySignedCatalog(envelope,trustKeys);
  enforceReleasePin(snapshot,envelope,pins);
  assert.ok(snapshot.items.length>0,'signed build: empty catalog not permitted');
  const report=createReleaseReview(files);
  const htmlByPath=new Map(files.filter(file=>file.path.endsWith('.html'))
    .map(file=>[file.path,file.bytes.toString('utf8')]));
  for(const item of snapshot.items) {
    assert.ok(allowedSlugs.has(item.slug),'signed build: service slug not in curated pages');
    const htmlPath='servicos/'+item.slug+'/index.html';
    assert.ok(htmlByPath.has(htmlPath),'signed build: published service output absent');
    const html=htmlByPath.get(htmlPath);
    verifyIndexablePage(html,toAbsoluteUrl(item.path));
    assert.equal(singleCaptured(html,/<title>([\s\S]*?)<\/title>/gi,'HTML title'),
      item.title,'signed build: HTML title differs from signed catalog');
    assert.equal(singleCaptured(html,
      /<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/gi,'meta description'),
      item.description,'signed build: description differs from signed catalog');
    assert.equal(singleCaptured(html,/<p class="lead">([^<]*)<\/p>/gi,'service intro'),
      item.description,'signed build: service intro differs from signed catalog');
  }
  return Object.freeze({
    schema:'imagine.comercial.signed-build-review.v1',
    mode:'SIGNED_BUILD_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
    releaseId:snapshot.releaseId,
    keyId:envelope.keyId,
    payloadSha256:payloadSha256(envelope),
    treeSha256:report.treeSha256,
    fileCount:report.fileCount,
    verifiedServiceCount:snapshot.items.length
  });
}
