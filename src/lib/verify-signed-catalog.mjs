/**
 * F8 — verificação offline de integridade e identidade criptográfica de um
 * snapshot mínimo de catálogo enviado pelo futuro publicador do Portal.
 *
 * A chave privada jamais pertence ao site comercial ou ao GitHub.
 * A confiança depende de gestão de chaves, acesso e aprovação do Portal.
 * NÃO autoriza conteúdo/tenant, não faz deploy nem substitui AuthN/AuthZ.
 */
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { validatePublishedCatalog } from './published-catalog.mjs';

const DOMAIN=Buffer.from('imagine-commercial-catalog-v1\0','utf8');
const MAX_PAYLOAD_BYTES=1024*1024;
const EXPECTED=new Set(['protocol','keyId','payloadBase64','signatureBase64']);
const KEY_ID=/^[a-z][a-z0-9_-]{4,63}$/;

function decodeBase64(value,max,name){
  if(typeof value!=='string'||value.length===0||value.length>Math.ceil(max/3)*4+4 ||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)){
    throw new Error('catalog signature: invalid '+name);
  }
  const bytes=Buffer.from(value,'base64');
  if(bytes.length>max || bytes.toString('base64')!==value) throw new Error('catalog signature: invalid '+name);
  return bytes;
}

export function verifySignedCatalog(envelope,trustKeys){
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||Object.getPrototypeOf(envelope)!==Object.prototype){
    throw new Error('catalog signature: plain object required');
  }
  if(Object.keys(envelope).some(key=>!EXPECTED.has(key)))throw new Error('catalog signature: unexpected field');
  if(envelope.protocol!=='imagine-catalog-v1')throw new Error('catalog signature: unsupported protocol');
  if(typeof envelope.keyId!=='string'||!KEY_ID.test(envelope.keyId))throw new Error('catalog signature: invalid key ID');
  if(!(trustKeys instanceof Map))throw new Error('catalog signature: trusted key map required');
  const pem=trustKeys.get(envelope.keyId);
  if(typeof pem!=='string'||!pem.includes('BEGIN PUBLIC KEY'))throw new Error('catalog signature: unknown key ID');
  const publicKey=createPublicKey(pem);
  if(publicKey.asymmetricKeyType!=='ed25519')throw new Error('catalog signature: Ed25519 key required');
  const payload=decodeBase64(envelope.payloadBase64,MAX_PAYLOAD_BYTES,'payload');
  const signature=decodeBase64(envelope.signatureBase64,64,'signature');
  if(signature.length!==64)throw new Error('catalog signature: signature length invalid');
  const verified=cryptoVerify(null,Buffer.concat([DOMAIN,payload]),publicKey,signature);
  if(!verified)throw new Error('catalog signature: verification failed');
  let parsed;
  try{parsed=JSON.parse(payload.toString('utf8'));}
  catch {throw new Error('catalog signature: invalid JSON payload');}
  return validatePublishedCatalog(parsed);
}
