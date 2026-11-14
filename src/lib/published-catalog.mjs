/**
 * Contrato de leitura de conteúdo público vindo do Portal (futuro).
 * Valida snapshots sintéticos/assinados previamente por um publicador confiável.
 * NÃO autentica API, não busca dados na rede nem altera sites/checkout.
 */
const fieldSet = fields => new Set(fields);
const ROOT = fieldSet(['schemaVersion', 'releaseId', 'publishedAt', 'items']);
const ITEM = fieldSet(['id', 'slug', 'title', 'description', 'path', 'version', 'status', 'offerRef']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTIFIER = /^[a-z][a-z0-9_-]{5,79}$/;
const OFFER = /^offer_[a-z0-9_-]{6,80}$/;
// Invisible and bidirectional control characters must never enter signed
// customer-facing titles/descriptions. Reject rather than rewrite signed text.
const NONDISPLAY=/[\u007f-\u009f\u00ad\u034f\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u;
const UNPAIRED_SURROGATE=/[\ud800-\udfff]/u;
const dateIsIso = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'));

function isRecord(value) {
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype)return false;
  // F213: only enumerable, own JSON data fields. Never execute a getter,
  // silently skip a nonenumerable private field or accept symbol metadata.
  return Reflect.ownKeys(value).every(key=>{
    if(typeof key!=='string')return false;
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return descriptor?.enumerable===true&&Object.hasOwn(descriptor,'value');
  });
}

function isDenseDataArray(value,max){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
     value.length>max)return false;
  const keys=Reflect.ownKeys(value);
  if(keys.length!==value.length+1)return false;
  for(let i=0;i<value.length;i++){
    const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    if(!descriptor||descriptor.enumerable!==true||
       !Object.hasOwn(descriptor,'value'))return false;
  }
  return true;
}

function assertFields(obj,allowed,context){
  for(const key of Reflect.ownKeys(obj)){
    if(!allowed.has(key))
      throw new Error(context+': unsupported/private field');
  }
}

function plainString(value, name, min, max) {
  if (typeof value !== 'string' || value.length < min || value.length > max ||
      /[<>\x00-\x1F]/.test(value) || NONDISPLAY.test(value) ||
      UNPAIRED_SURROGATE.test(value) || value.normalize('NFC')!==value) {
    throw new Error(name + ': invalid plain text');
  }
  return value;
}

export function validatePublishedCatalog(input) {
  if (!isRecord(input)) throw new Error('catalog: object required');
  assertFields(input, ROOT, 'catalog');
  if (input.schemaVersion !== '1.0') throw new Error('catalog: unsupported schema');
  if (typeof input.releaseId !== 'string' || !IDENTIFIER.test(input.releaseId)) {
    throw new Error('catalog: invalid releaseId');
  }
  if (!dateIsIso(input.publishedAt)) throw new Error('catalog: invalid publishedAt');
  if (!isDenseDataArray(input.items,10000)) {
    throw new Error('catalog: invalid items');
  }

  const seenIds = new Set(), seenPaths = new Set();
  const items = input.items.map((item, i) => {
    const ctx = 'item ' + i;
    if (!isRecord(item)) throw new Error(ctx + ': object required');
    assertFields(item, ITEM, ctx);
    const id = plainString(item.id, ctx + ' id', 6, 80);
    if (!IDENTIFIER.test(id)) throw new Error(ctx + ': invalid id');
    const slug = plainString(item.slug, ctx + ' slug', 2, 80);
    if (!SLUG.test(slug)) throw new Error(ctx + ': invalid slug');
    const title = plainString(item.title, ctx + ' title', 15, 100);
    const description = plainString(item.description, ctx + ' description', 50, 180);
    const path = '/servicos/' + slug + '/';
    if (item.path !== path) throw new Error(ctx + ': inconsistent path');
    if (item.status !== 'published') throw new Error(ctx + ': unpublished entry');
    if (!Number.isSafeInteger(item.version) || item.version < 1) throw new Error(ctx + ': invalid version');
    if (item.offerRef !== undefined && (typeof item.offerRef !== 'string' || !OFFER.test(item.offerRef))) {
      throw new Error(ctx + ': invalid offer reference');
    }
    if (seenIds.has(id) || seenPaths.has(path)) throw new Error(ctx + ': duplicate service');
    seenIds.add(id);
    seenPaths.add(path);
    return Object.freeze({
      id, slug, title, description, path, status: 'published', version: item.version,
      ...(item.offerRef ? { offerRef: item.offerRef } : {})
    });
  });
  return Object.freeze({
    schemaVersion: '1.0',
    releaseId: input.releaseId,
    publishedAt: input.publishedAt,
    items: Object.freeze(items)
  });
}
