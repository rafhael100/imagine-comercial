/**
 * F30 — contrato de LEAD em LABORATÓRIO, sem formulário ou rede.
 *
 * Este módulo não cria endpoint, não persiste dados pessoais, não envia
 * informações ao CRM e NÃO certifica conformidade LGPD. A versão pública
 * exigirá aviso de privacidade aprovado, consentimento registrável, limite de
 * taxa, antibot, proteção contra abuso, API autenticada e retenção contratual.
 */
import {services} from '../data/services.mjs';

const allowedSlugs=new Set(services.map(x=>x.slug));
const keys=['name','email','phone','serviceSlug','details','consent','honeypot'];
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern=/^[a-z0-9.!#$%&'*+/=?^_{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i;
const phonePattern=/^\+[1-9][0-9]{7,14}$/;
const unsafeControl=/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

function exactFields(data) {
  if(!data || typeof data!=='object' || Array.isArray(data) ||
     Object.keys(data).length!==keys.length ||
     !keys.every(k=>Object.hasOwn(data,k))) {
    throw new Error('lead: unsupported or missing public fields');
  }
}

export function validateSyntheticLeadDraft(input) {
  exactFields(input);
  for(const key of keys) {
    if(key!=='consent' && typeof input[key]!=='string') {
      throw new Error('lead: field must be text: '+key);
    }
  }
  if(input.honeypot!=='')throw new Error('lead: bot trap was filled');
  if(input.consent!==true)throw new Error('lead: explicit contact consent required');

  const name=input.name.trim().replace(/\s+/g,' ');
  const email=input.email.trim().toLowerCase();
  const phone=input.phone.trim();
  const details=input.details.trim();
  const slug=input.serviceSlug.trim();

  if(name.length<3||name.length>120||unsafeControl.test(name) ||
     /[<>@\r\n]/.test(name))throw new Error('lead: invalid contact name');
  if(email.length<5||email.length>254||!emailPattern.test(email) ||
     email.includes('..'))throw new Error('lead: invalid email');
  if(phone!==''&&!phonePattern.test(phone))throw new Error('lead: invalid E.164 phone');
  if(!allowedSlugs.has(slug))throw new Error('lead: unknown service');
  if(details.length<10||details.length>1600||unsafeControl.test(details))
    throw new Error('lead: invalid message length/characters');
  return Object.freeze({
    schema:'imagine.comercial.lead-draft.v1',
    name,email,phone,serviceSlug:slug,details,
    consent:true
  });
}

/**
 * In-memory idempotency demonstration only. MUST NOT be used as a production
 * CRM inbox: it cannot survive restart or enforce cross-instance uniqueness.
 * The stored synthetic draft remains private to this instance, never logged.
 */
export class SyntheticLeadInbox {
  #receipts=new Map();
  submit(draft,idempotencyKey) {
    if(!uuidV4.test(idempotencyKey))throw new Error('lead: invalid idempotency UUID');
    if(!draft||draft.schema!=='imagine.comercial.lead-draft.v1')
      throw new Error('lead: validated draft required');
    const canonical=JSON.stringify(draft);
    const old=this.#receipts.get(idempotencyKey);
    if(old) {
      if(old.canonical!==canonical)throw new Error('lead: idempotency conflict');
      return Object.freeze({
        mode:'SYNTHETIC_IN_MEMORY_NO_NETWORK',receiptId:idempotencyKey,
        outcome:'duplicate_ack'
      });
    }
    this.#receipts.set(idempotencyKey,{canonical});
    return Object.freeze({
      mode:'SYNTHETIC_IN_MEMORY_NO_NETWORK',receiptId:idempotencyKey,
      outcome:'accepted_lab_only'
    });
  }
  get count() {return this.#receipts.size;}
}
