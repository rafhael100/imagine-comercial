/**
 * F202 — inspect two independently pinned, signed CMS snapshot versions.
 *
 * Input snapshots can be PARTIAL deltas; omitting a slug does not mean
 * deleting a service. This is REVIEW ONLY, never an approval, authorization,
 * tenant check, active CMS API or deployment mechanism.
 */
import {verifySignedCatalog} from './verify-signed-catalog.mjs';
import {enforceReleasePin} from './release-pin.mjs';
import {services} from '../data/services.mjs';
import {mergeApprovedServiceMetadata} from './build-catalog.mjs';
const approvedSlugs=new Set(services.map(item=>item.slug));

export function reviewSignedCatalogTransition({
  previousEnvelope,nextEnvelope,trustKeys,previousPin,nextPin
}={}){
  const prev=verifySignedCatalog(previousEnvelope,trustKeys);
  const next=verifySignedCatalog(nextEnvelope,trustKeys);
  enforceReleasePin(prev,previousEnvelope,previousPin);
  enforceReleasePin(next,nextEnvelope,nextPin);
  if(prev.releaseId===next.releaseId)
    throw Error('F202: repeated release identity');
  if(Date.parse(next.publishedAt)<=Date.parse(prev.publishedAt))
    throw Error('F202: nonmonotonic publishedAt');
  if(prev.items.some(item=>!approvedSlugs.has(item.slug))||
     next.items.some(item=>!approvedSlugs.has(item.slug)))
    throw Error('F202: unknown public service route');
  // F209: a signed transition report must enforce the exact production
  // build's FINAL six-page SEO metadata rule, including untouched pages.
  // Signatures and pins are not editorial SEO approvals.
  mergeApprovedServiceMetadata(services,next);
  const prevBySlug=new Map(prev.items.map(item=>[item.slug,item]));
  const prevById=new Map(prev.items.map(item=>[item.id,item.slug]));
  let compared=0,advanced=0,edited=0,newInPartial=0;
  for(const incoming of next.items){
    const original=prevBySlug.get(incoming.slug);
    if(prevById.has(incoming.id)&&prevById.get(incoming.id)!==incoming.slug)
      throw Error('F202: slug change requires separate SEO redirect review');
    if(!original){newInPartial++;continue;}
    if(original.id!==incoming.id)
      throw Error('F202: service identity replaced');
    if(incoming.version<original.version)
      throw Error('F202: version rollback refused');
    const changed=original.title!==incoming.title||
      original.description!==incoming.description||
      (original.offerRef??null)!==(incoming.offerRef??null);
    if(changed && incoming.version===original.version)
      throw Error('F202: editorial change without version advance');
    compared++;
    if(incoming.version>original.version)advanced++;
    if(changed)edited++;
  }
  return Object.freeze({
    schema:'imagine.comercial.signed-catalog-transition-review.v1',
    previousReleaseId:prev.releaseId,
    candidateReleaseId:next.releaseId,
    comparedSlugs:compared,
    versionAdvanced:advanced,
    editorialChanges:edited,
    notPresentInPriorPartial:newInPartial,
    absentFromCandidatePartial:prev.items.length-compared,
    deletionAssumed:false,
    publicRoutesCreated:false,
    independentEditorialApprovalVerified:false,
    tenantAuthorizationVerified:false,
    canPublish:false,
    deploymentPerformed:false
  });
}
