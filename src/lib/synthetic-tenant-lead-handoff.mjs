/**
 * F77 — synthetic tenant-scoped Portal/CRM handoff ONLY.
 *
 * The policies and tenant IDs below are LAB fixtures, never authorization
 * claims. There are no endpoints, network clients, secrets or durable storage.
 * Real Portal authentication, grants, consent provenance, outbox and CRM
 * delivery must be independently implemented and audited.
 */
import {services} from '../data/services.mjs';
import {SyntheticLeadInbox,validateSyntheticLeadDraft} from './lead-intake-lab.mjs';

const allowedSlugs=new Set(services.map(service=>service.slug));
const tenantIdPattern=/^lab-tenant-[a-z0-9-]{3,36}$/;
const proofMarker='LAB_CONSENT_PROOF_NOT_VERIFIED';
function plain(x){
  return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
    Object.getPrototypeOf(x)===Object.prototype;
}
function policiesFromFixtures(fixtures){
  if(!Array.isArray(fixtures)||fixtures.length<1||fixtures.length>8)
    throw new Error('F77: invalid lab tenant fixtures');
  const policies=new Map();
  for(const item of fixtures){
    if(!plain(item)||Object.keys(item).length!==2||
       !Object.hasOwn(item,'tenantId')||!Object.hasOwn(item,'serviceSlugs')||
       typeof item.tenantId!=='string'||!tenantIdPattern.test(item.tenantId)||
       policies.has(item.tenantId)||!Array.isArray(item.serviceSlugs)||
       item.serviceSlugs.length<1||item.serviceSlugs.length>allowedSlugs.size||
       item.serviceSlugs.some(s=>typeof s!=='string'||!allowedSlugs.has(s))||
       new Set(item.serviceSlugs).size!==item.serviceSlugs.length)
      throw new Error('F77: invalid lab tenant policy');
    policies.set(item.tenantId,new Set(item.serviceSlugs));
  }
  return policies;
}

export class SyntheticTenantLeadHandoff {
  #policies;
  #inboxes=new Map();
  #available=true;
  constructor(tenantFixtures){
    this.#policies=policiesFromFixtures(tenantFixtures);
  }
  setSimulatedDownstreamAvailability(available){
    if(typeof available!=='boolean')throw new Error('F77: invalid lab availability');
    this.#available=available;
  }
  submitLab({tenantId,idempotencyKey,draft,consentProof}={}){
    if(typeof tenantId!=='string'||!this.#policies.has(tenantId))
      throw new Error('F77: unknown lab tenant');
    if(consentProof!==proofMarker)
      throw new Error('F77: simulated consent proof required');
    // Always revalidate the raw input; neither the caller nor the browser
    // may pass a trusted "already validated" envelope.
    const checked=validateSyntheticLeadDraft(draft);
    if(!this.#policies.get(tenantId).has(checked.serviceSlug))
      throw new Error('F77: service not allowed for lab tenant');
    if(!this.#available)
      throw new Error('F77: simulated downstream unavailable');
    let inbox=this.#inboxes.get(tenantId);
    if(!inbox){
      inbox=new SyntheticLeadInbox();
      // Invalid UUIDs cannot create a new accepted record; the per-tenant
      // inbox remains lab-only and returns no personal fields.
    }
    const receipt=inbox.submit(draft,idempotencyKey);
    this.#inboxes.set(tenantId,inbox);
    return Object.freeze({
      schema:'imagine.comercial.synthetic-tenant-handoff.v1',
      mode:'LAB_ONLY_NO_NETWORK_NO_DURABLE_DELIVERY',
      receiptId:receipt.receiptId,
      outcome:receipt.outcome==='duplicate_ack'?'duplicate_lab_ack':'accepted_lab_only',
      deliveryProven:false,
      deploymentAuthorized:false
    });
  }
  syntheticCount(tenantId){
    if(!this.#policies.has(tenantId))throw new Error('F77: unknown lab tenant');
    return this.#inboxes.get(tenantId)?.count??0;
  }
}

export const SYNTHETIC_CONSENT_PROOF=proofMarker;
