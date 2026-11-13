/**
 * F305 — reconstruct cumulative public service metadata from signed,
 * versioned Portal CMS publication snapshots. A partial snapshot changes
 * ONLY the slugs present in it, never erases prior signed edits.
 *
 * The first release MUST be a complete six-service checkpoint. Its source
 * and the set of releases require independent authenticity/completeness
 * attestation before operational use; this module cannot provide that.
 *
 * Offline review only: no network, CMS session, tokens, DB, deploy or I/O.
 */
import {services} from '../data/services.mjs';
import {verifySignedCatalog} from './verify-signed-catalog.mjs';
import {enforceReleasePin,payloadSha256} from './release-pin.mjs';
import {enforceSignedPublicationTime} from './signed-publication-time.mjs';
import {mergeApprovedServiceMetadata} from './build-catalog.mjs';

const MAX_RELEASES=32;
const knownSlugs=new Set(services.map(item=>item.slug));
const plainData=value=>value!==null&&typeof value==='object'&&
  !Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&
  Reflect.ownKeys(value).every(key=>{
    if(typeof key!=='string')return false;
    const d=Object.getOwnPropertyDescriptor(value,key);
    return d?.enumerable===true&&Object.hasOwn(d,'value');
  });
function exactFields(value,fields){
  return plainData(value)&&Reflect.ownKeys(value).length===fields.length&&
    fields.every(key=>Object.hasOwn(value,key));
}
function denseDataArray(value){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
    value.length<2||value.length>MAX_RELEASES||
    Reflect.ownKeys(value).length!==value.length+1)return false;
  return Array.from({length:value.length},(_,index)=>{
    const d=Object.getOwnPropertyDescriptor(value,String(index));
    return d?.enumerable===true&&Object.hasOwn(d,'value');
  }).every(Boolean);
}

export function reconstructSignedCatalogCheckpointHistory({
  releases,trustKeys,expectedLatestReleaseId,expectedLatestPayloadSha256,
  nowMs=Date.now()
}={}){
  if(!denseDataArray(releases)||!(trustKeys instanceof Map)||
    trustKeys.size<1||trustKeys.size>32||
    typeof expectedLatestReleaseId!=='string'||
    typeof expectedLatestPayloadSha256!=='string')
    throw Error('F305: verified signed checkpoint history required');
  const bySlug=new Map(),byId=new Map(),ids=new Set();
  let prevTime=-1,latestSnapshot,latestEnvelope;
  let amendments=0,changed=0;
  for(let index=0;index<releases.length;index++){
    const record=releases[index];
    if(!exactFields(record,['envelope','pin'])||
      !exactFields(record.pin,['expectedReleaseId','expectedPayloadSha256']))
      throw Error('F305: unsafe release entry or pin');
    const snapshot=verifySignedCatalog(record.envelope,trustKeys);
    enforceReleasePin(snapshot,record.envelope,record.pin);
    enforceSignedPublicationTime(snapshot.publishedAt,nowMs);
    if(ids.has(snapshot.releaseId))
      throw Error('F305: repeated release identity');
    ids.add(snapshot.releaseId);
    const nextTime=Date.parse(snapshot.publishedAt);
    if(nextTime<=prevTime)throw Error('F305: publication time not increasing');
    prevTime=nextTime;
    if(index===0){
      if(snapshot.items.length!==knownSlugs.size||
        snapshot.items.some(item=>!knownSlugs.has(item.slug))||
        new Set(snapshot.items.map(item=>item.slug)).size!==knownSlugs.size)
        throw Error('F305: first release must be a complete public catalog checkpoint');
    }
    for(const item of snapshot.items){
      if(!knownSlugs.has(item.slug))
        throw Error('F305: unapproved public service route');
      const previous=bySlug.get(item.slug);
      const matchingSlug=byId.get(item.id);
      if(matchingSlug!==undefined&&matchingSlug!==item.slug)
        throw Error('F305: service ID moved to a new slug');
      if(previous && previous.id!==item.id)
        throw Error('F305: service ID changed within same slug');
      if(previous&&item.version<previous.version)
        throw Error('F305: service version rollback');
      const edited=previous&&(previous.title!==item.title||
        previous.description!==item.description||
        (previous.offerRef??null)!==(item.offerRef??null));
      if(edited && item.version===previous.version)
        throw Error('F305: changed public content without version increment');
      if(index>0)amendments++;
      if(edited)changed++;
      bySlug.set(item.slug,item);
      byId.set(item.id,item.slug);
    }
    // Always check the effective FINAL metadata against six actual pages,
    // including unchanged services and previous signed amendments.
    mergeApprovedServiceMetadata(services,{items:[...bySlug.values()]});
    latestSnapshot=snapshot;
    latestEnvelope=record.envelope;
  }
  // Even if all earlier releases are signed, a truncated chain could omit
  // past edits. The trusted externally selected latest release must match.
  enforceReleasePin(latestSnapshot,latestEnvelope,{
    expectedReleaseId:expectedLatestReleaseId,
    expectedPayloadSha256:expectedLatestPayloadSha256
  });
  const effective=Object.freeze([...bySlug.values()]);
  return Object.freeze({
    schema:'imagine.comercial.signed-catalog-checkpoint-history.v1',
    status:'COMPLETE_SIGNED_CHECKPOINT_AND_PARTIALS_REVIEW_ONLY',
    effectiveItems:effective,
    releasesChecked:releases.length,
    serviceCount:effective.length,
    partialAmendmentsReviewed:amendments,
    signedEditorialChanges:changed,
    latestReleaseId:latestSnapshot.releaseId,
    latestPayloadSha256:payloadSha256(latestEnvelope),
    independentFullHistoryAttestationVerified:false,
    portalTenantAuthorizationVerified:false,
    cmsPublicationPermissionVerified:false,
    canPublish:false,
    deploymentPerformed:false
  });
}
