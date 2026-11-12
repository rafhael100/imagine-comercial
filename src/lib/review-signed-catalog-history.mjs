/**
 * F214: review a bounded ordered CHAIN of independently pinned, Ed25519-
 * signed PARTIAL CMS publication snapshots. No network, persistence, IAM,
 * auto-release or claim that the operator supplied the full real history.
 */
import {verifySignedCatalog} from './verify-signed-catalog.mjs';
import {enforceReleasePin} from './release-pin.mjs';
import {enforceSignedPublicationTime,mergeApprovedServiceMetadata}
  from './build-catalog.mjs';
import {services} from '../data/services.mjs';

const knownSlugs=new Set(services.map(s=>s.slug));
const MAX_REVIEW_RELEASES=32;
export function reviewSignedCatalogHistory({
  releases,trustKeys,nowMs=Date.now()
}={}){
  if(!Array.isArray(releases)||Object.getPrototypeOf(releases)!==Array.prototype||
      releases.length<2||releases.length>MAX_REVIEW_RELEASES||
      Reflect.ownKeys(releases).length!==releases.length+1)
    throw Error('F214: invalid bounded release sequence');
  if(!(trustKeys instanceof Map)||trustKeys.size<1||trustKeys.size>32)
    throw Error('F214: trusted public keys required');
  const seenReleaseIds=new Set();
  const bySlug=new Map();
  const byId=new Map();
  let lastTime=-1,incremented=0,changed=0,totalCompared=0;
  let maximumPartialSize=0;
  for(let index=0;index<releases.length;index++){
    const input=releases[index];
    if(!input||typeof input!=='object'||Array.isArray(input)||
       Object.getPrototypeOf(input)!==Object.prototype||
       Reflect.ownKeys(input).length!==2||
       !Object.hasOwn(input,'envelope')||!Object.hasOwn(input,'pin'))
      throw Error('F214: invalid release entry');
    const snapshot=verifySignedCatalog(input.envelope,trustKeys);
    enforceReleasePin(snapshot,input.envelope,input.pin);
    if(seenReleaseIds.has(snapshot.releaseId))
      throw Error('F214: repeated release identity');
    seenReleaseIds.add(snapshot.releaseId);
    const timestamp=Date.parse(snapshot.publishedAt);
    if(timestamp<=lastTime)throw Error('F214: nonmonotonic publication time');
    enforceSignedPublicationTime(snapshot.publishedAt,nowMs);
    lastTime=timestamp;
    maximumPartialSize=Math.max(maximumPartialSize,snapshot.items.length);
    // Every omitted slug remains at its latest signed revision. Never infer
    // that a service disappeared or that a partial update is an SEO reset.
    const candidate=new Map(bySlug);
    const candidateIds=new Map(byId);
    for(const item of snapshot.items){
      if(!knownSlugs.has(item.slug))
        throw Error('F214: unreviewed public service slug');
      const previous=candidate.get(item.slug);
      const previousSlug=candidateIds.get(item.id);
      if(previousSlug!==undefined&&previousSlug!==item.slug)
        throw Error('F214: historical slug migration requires SEO review');
      if(previous&&previous.id!==item.id)
        throw Error('F214: historical service identity changed');
      if(previous&&item.version<previous.version)
        throw Error('F214: version rollback across partial releases');
      const edited=previous&&(
        item.title!==previous.title||
        item.description!==previous.description||
        (item.offerRef??null)!==(previous.offerRef??null));
      if(edited&&item.version===previous.version)
        throw Error('F214: change without monotonic service version');
      if(previous){
        totalCompared++;
        if(item.version>previous.version)incremented++;
        if(edited)changed++;
      }
      candidate.set(item.slug,item);
      candidateIds.set(item.id,item.slug);
    }
    // Evaluate the FINAL effective service catalog, not just this delta.
    // All six public SEO titles/descriptions must stay unique at each step.
    mergeApprovedServiceMetadata(services,{items:[...candidate.values()]});
    bySlug.clear();
    for(const [slug,value] of candidate)bySlug.set(slug,value);
    byId.clear();
    for(const [id,slug] of candidateIds)byId.set(id,slug);
  }
  return Object.freeze({
    schema:'imagine.comercial.signed-catalog-history-review.v1',
    releasesChecked:releases.length,
    reviewedServices:bySlug.size,
    repeatedServicesCompared:totalCompared,
    versionIncrements:incremented,
    editorialChanges:changed,
    largestPartialRelease:maximumPartialSize,
    omissionsAreDeletions:false,
    completeReleaseHistoryVerified:false,
    independentEditorialApprovalVerified:false,
    tenantAuthorizationVerified:false,
    canPublish:false,
    deploymentPerformed:false
  });
}
