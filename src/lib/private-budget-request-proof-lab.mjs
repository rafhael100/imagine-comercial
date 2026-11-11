/**
 * P0-F176: signed, short-lived, one-use request proof for isolated test labs.
 * This is NOT captcha, bot resistance, consent evidence, session auth, an
 * intake authorization or an operational CRM receipt.
 */
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const ttlMs=120_000;
const scopeFormat=/^[a-z0-9-]{8,64}$/;
const originFormat=/^http:\/\/127\.0\.0\.1:(?:[1-9][0-9]{3,4})$/;
const nonceFormat=/^[A-Za-z0-9_-]{24}$/;
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const safeOrigin=origin=>typeof origin==='string'&&originFormat.test(origin)&&
  Number(origin.split(':').at(-1))<=65535;
const safeKey=key=>Buffer.isBuffer(key)&&key.length>=32&&key.length<=64;
const mac=(key,data)=>createHmac('sha256',key)
  .update('imagine.private-budget.proof.lab.v1\n'+data,'utf8').digest();
const denial=code=>Object.freeze({
  schema:'imagine.comercial.private-budget-request-proof-lab.v1',
  code,
  cryptographicStructureChecked:false,
  oneTimeNonceClaimedInLab:false,
  durableReplayPreventionProven:false,
  captchaOrBotDefenseVerified:false,
  legalConsentVerified:false,
  tenantAuthorized:false,
  publicIntakeAllowed:false,
  canPersist:false,
  canAcknowledgeVisitor:false,
  canDeploy:false
});
const accepted=()=>Object.freeze({
  ...denial('SYNTHETIC_ONE_TIME_PROOF_VALID'),
  cryptographicStructureChecked:true,
  oneTimeNonceClaimedInLab:true
});

export function issuePrivateBudgetRequestProofLab({
  key,origin,scope,nowMs=Date.now(),entropy=randomBytes(18)
}={}){
  if(!safeKey(key)||!safeOrigin(origin)||typeof scope!=='string'||
     !scopeFormat.test(scope)||!Number.isSafeInteger(nowMs)||nowMs<1||
     !Buffer.isBuffer(entropy)||entropy.length!==18)
    throw Error('F176: invalid synthetic proof issuer context');
  const payload=Buffer.from(JSON.stringify({
    version:1,issuedAtMs:nowMs,
    nonce:entropy.toString('base64url'),origin,scope
  }),'utf8').toString('base64url');
  return Object.freeze({
    token:'v1.'+payload+'.'+mac(key,payload).toString('base64url'),
    ttlSeconds:ttlMs/1000,
    schema:'imagine.comercial.private-budget-issued-proof-lab.v1',
    authorizationForRealIntake:false,
    durableStorageProvided:false
  });
}

export async function inspectPrivateBudgetRequestProofLab({
  key,token,origin,scope,nowMs=Date.now(),claimNonce
}={}){
  try{
    if(!safeKey(key)||!safeOrigin(origin)||typeof scope!=='string'||
       !scopeFormat.test(scope)||!Number.isSafeInteger(nowMs)||nowMs<1||
       typeof claimNonce!=='function'||typeof token!=='string'||
       token.length>512||token.length<90)
      return denial('INVALID_CONTEXT');
    const parts=token.split('.');
    if(parts.length!==3||parts[0]!=='v1'||
       !/^[A-Za-z0-9_-]{50,350}$/.test(parts[1])||
       !/^[A-Za-z0-9_-]{43}$/.test(parts[2]))
      return denial('MALFORMED_PROOF');
    const received=Buffer.from(parts[2],'base64url');
    const expected=mac(key,parts[1]);
    if(received.length!==expected.length||
       received.toString('base64url')!==parts[2]||
       !timingSafeEqual(received,expected))
      return denial('INVALID_SIGNATURE');
    const raw=Buffer.from(parts[1],'base64url');
    if(raw.toString('base64url')!==parts[1]||raw.length>512)
      return denial('MALFORMED_PROOF');
    const data=JSON.parse(raw.toString('utf8'));
    if(!isPlain(data)||Object.keys(data).length!==5||
       !['version','issuedAtMs','nonce','origin','scope']
         .every(k=>Object.hasOwn(data,k))||
       data.version!==1||!Number.isSafeInteger(data.issuedAtMs)||
       typeof data.nonce!=='string'||!nonceFormat.test(data.nonce)||
       typeof data.origin!=='string'||typeof data.scope!=='string')
      return denial('INVALID_PAYLOAD');
    if(data.origin!==origin||data.scope!==scope)
      return denial('CONTEXT_MISMATCH');
    if(data.issuedAtMs>nowMs||nowMs-data.issuedAtMs>ttlMs)
      return denial('EXPIRED_OR_FUTURE');
    const claimed=await claimNonce(data.nonce,data.issuedAtMs+ttlMs);
    if(claimed!==true)return denial('NONCE_ALREADY_USED_OR_NOT_DURABLE');
    return accepted();
  }catch{
    return denial('PROOF_REVIEW_FAILED_CLOSED');
  }
}
