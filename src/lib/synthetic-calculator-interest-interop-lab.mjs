/**
 * PERF-CALC-F1 — server-side, OFFLINE synthetic calculator intent envelope.
 *
 * Not a browser or email API. Caller-provided CI key is not a credential and
 * a valid MAC NEVER proves tenant authorization, consent or CRM persistence.
 * No PII fields, cookies, network, queue, lead creation or mail delivery.
 */
import {createHmac, timingSafeEqual} from 'node:crypto';

const SCHEMA='imagine.calculator.synthetic-interest.v1';
const SOURCE='imagine_comercial_calculadora_performance';
const DOMAIN='imagine.comercial.calculator.synthetic-interest.v1';
const CHANNELS=['chatgpt_ads','google_ads','meta_ads'];
const UUID_V4=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX=/^[a-f0-9]{64}$/;
const FIELDS=['schema','source','submission_id','channel_ids','currency',
  'media_total_cents','report_requested','marketing_requested',
  'notice_version','issued_at','expires_at','nonce'];
const SIGNED=['payload','signature'];

function plainExact(obj,keys) {
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||
     Object.getPrototypeOf(obj)!==Object.prototype||
     Reflect.ownKeys(obj).length!==keys.length)
    throw new Error('Untrusted calculator intent fields');
  for(const key of keys){
    const prop=Object.getOwnPropertyDescriptor(obj,key);
    if(!prop||prop.enumerable!==true||!Object.hasOwn(prop,'value'))
      throw new Error('Untrusted calculator intent fields');
  }
  if(Reflect.ownKeys(obj).some(k=>typeof k!=='string'||!keys.includes(k)))
    throw new Error('Unexpected calculator intent fields');
}
function assertPayload(payload) {
  plainExact(payload,FIELDS);
  if(payload.schema!==SCHEMA||payload.source!==SOURCE||payload.currency!=='BRL'||
     !UUID_V4.test(payload.submission_id)||!UUID_V4.test(payload.nonce)||
     payload.submission_id===payload.nonce||
     payload.notice_version!=='lab-notice-v1'||
     !Array.isArray(payload.channel_ids)||
     Object.getPrototypeOf(payload.channel_ids)!==Array.prototype||
     payload.channel_ids.length<1||payload.channel_ids.length>3||
     Reflect.ownKeys(payload.channel_ids).length!==payload.channel_ids.length+1||
     payload.channel_ids.some(id=>!CHANNELS.includes(id))||
     payload.channel_ids.join(',')!==[...new Set(payload.channel_ids)].sort().join(',')||
     !Number.isSafeInteger(payload.media_total_cents)||
     payload.media_total_cents<70000||payload.media_total_cents>300000000||
     typeof payload.report_requested!=='boolean'||
     typeof payload.marketing_requested!=='boolean'||
     (!payload.report_requested&&!payload.marketing_requested)||
     !Number.isSafeInteger(payload.issued_at)||!Number.isSafeInteger(payload.expires_at)||
     payload.issued_at<=0||payload.expires_at<=payload.issued_at||
     payload.expires_at-payload.issued_at>300)
    throw new Error('Invalid calculator intent');
  return payload;
}
export function calculatorIntentSigningBytes(payload) {
  assertPayload(payload);
  return [
    DOMAIN,payload.schema,payload.source,payload.submission_id,
    payload.channel_ids.join(','),payload.currency,
    String(payload.media_total_cents),
    payload.report_requested?'1':'0',
    payload.marketing_requested?'1':'0',
    payload.notice_version,
    String(payload.issued_at),String(payload.expires_at),payload.nonce
  ].join('\n');
}
function keyCheck(key){
  if(typeof key!=='string'||Buffer.byteLength(key,'utf8')<32)
    throw new Error('Synthetic fixture key absent');
}
export function createSyntheticCalculatorIntent(payload,syntheticKey){
  keyCheck(syntheticKey);
  const message=calculatorIntentSigningBytes(payload);
  const signature=createHmac('sha256',syntheticKey).update(message,'utf8').digest('hex');
  return Object.freeze({
    payload:Object.freeze({...payload,channel_ids:Object.freeze([...payload.channel_ids])}),
    signature
  });
}
export function inspectSyntheticCalculatorIntent(envelope,syntheticKey,now){
  const denied=(state)=>Object.freeze({
    state,synthetic_mac_matches:false,
    tenant_authorized:false,consent_proven:false,
    crm_durable_receipt_proven:false,can_send_report:false,
    can_send_marketing:false,can_store_lead:false
  });
  try {
    plainExact(envelope,SIGNED);
    keyCheck(syntheticKey);
    const bytes=calculatorIntentSigningBytes(envelope.payload);
    if(typeof envelope.signature!=='string'||!HEX.test(envelope.signature)||
       !Number.isSafeInteger(now)||now<=0||
       envelope.payload.issued_at>now+30||envelope.payload.expires_at<=now)
      return denied('DENIED_INVALID_SIGNATURE_OR_WINDOW');
    const expected=createHmac('sha256',syntheticKey).update(bytes,'utf8').digest();
    if(!timingSafeEqual(expected,Buffer.from(envelope.signature,'hex')))
      return denied('DENIED_MAC_MISMATCH');
    return Object.freeze({
      state:'SYNTHETIC_MAC_MATCH_UNTRUSTED',
      synthetic_mac_matches:true,
      tenant_authorized:false,consent_proven:false,
      crm_durable_receipt_proven:false,can_send_report:false,
      can_send_marketing:false,can_store_lead:false
    });
  }catch {
    return denied('DENIED_INVALID_ENVELOPE');
  }
}
