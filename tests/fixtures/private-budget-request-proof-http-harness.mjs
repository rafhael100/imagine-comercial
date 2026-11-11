/**
 * P0-F176: authenticated, non-production HTTP proof lab on 127.0.0.1.
 * Does NOT handle quote/contact payloads. No connection to CRM/Portal.
 */
import {createServer} from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {issuePrivateBudgetRequestProofLab,inspectPrivateBudgetRequestProofLab}
  from '../../src/lib/private-budget-request-proof-lab.mjs';

const ROUTE='/__lab/budget/request-proof';
const MAX_BODY=1024;
const SCOPE='synthetic-private-review-session';
const security=Object.freeze({
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'"
});
const digest=x=>createHash('sha256').update(x,'utf8').digest();
const response=(res,status,code,extra={})=>{
  res.writeHead(status);
  res.end(JSON.stringify({
    schema:'imagine.comercial.private-budget-request-proof-http-lab.v1',
    mode:'SYNTHETIC_PRIVATE_LAB_NOT_INTAKE',
    code,
    canCollectPublicLeads:false,
    canCreateCrmLead:false,
    canAcknowledgeVisitor:false,
    canDeploy:false,
    ...extra
  }));
};
function isReviewer(value,expected){
  if(typeof value!=='string'||value.length>400||
    !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(value))return false;
  const b64=value.slice(6),decoded=Buffer.from(b64,'base64');
  if(decoded.toString('base64')!==b64)return false;
  return timingSafeEqual(digest(decoded.toString('utf8')),expected);
}
export async function startPrivateBudgetRequestProofLab(password){
  if(typeof password!=='string'||password.length<24||password.length>128||
     !/^[\x21-\x7e]+$/.test(password))
    throw Error('P0-F176: strong synthetic-only password required');
  const key=randomBytes(32),nonces=new Set(),expected=digest('reviewer:'+password);
  const server=createServer(async(req,res)=>{
    for(const [k,v] of Object.entries(security))res.setHeader(k,v);
    const socket=server.address();
    if(!socket||typeof socket!=='object'||
       req.headers.host!=='127.0.0.1:'+socket.port){
      response(res,421,'INVALID_HOST');return;
    }
    if(!isReviewer(req.headers.authorization,expected)){
      res.setHeader('WWW-Authenticate','Basic realm="Imagine proof lab"');
      response(res,401,'AUTH_REQUIRED');return;
    }
    const origin='http://127.0.0.1:'+socket.port;
    if(req.url===ROUTE&&req.method==='GET'){
      if(nonces.size>=256){
        response(res,429,'LAB_REPLAY_CAP_REACHED');return;
      }
      const issued=issuePrivateBudgetRequestProofLab({
        key,origin,scope:SCOPE
      });
      response(res,200,'SYNTHETIC_PROOF_ISSUED',{
        token:issued.token,ttlSeconds:issued.ttlSeconds
      });return;
    }
    if(req.url!==ROUTE+'/verify'){
      response(res,404,'NOT_FOUND');return;
    }
    if(req.method!=='POST'){
      res.setHeader('Allow','POST');
      response(res,405,'METHOD_NOT_ALLOWED');return;
    }
    if(req.headers.origin!==origin){
      response(res,403,'UNTRUSTED_ORIGIN');return;
    }
    if(!/^application\/json(?:; charset=utf-8)?$/i
      .test(req.headers['content-type']||'')){
      response(res,415,'UNSUPPORTED_MEDIA_TYPE');return;
    }
    let total=0,tooLarge=false;
    const chunks=[];
    try{
      for await(const chunk of req){
        total+=chunk.length;
        if(total>MAX_BODY){tooLarge=true;continue;}
        chunks.push(chunk);
      }
    }catch{
      if(!res.writableEnded)response(res,400,'BODY_UNREADABLE');
      return;
    }
    if(tooLarge){response(res,413,'BODY_TOO_LARGE');return;}
    let candidate;
    try{candidate=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
    catch{response(res,400,'INVALID_JSON');return;}
    if(!candidate||Array.isArray(candidate)||
       typeof candidate!=='object'||Object.keys(candidate).length!==1||
       !Object.hasOwn(candidate,'token')||typeof candidate.token!=='string'){
      response(res,422,'TOKEN_ONLY_NO_CONTACT_FIELDS');return;
    }
    const result=await inspectPrivateBudgetRequestProofLab({
      key,token:candidate.token,origin,scope,
      claimNonce:nonce=>{
        if(nonces.size>=256||nonces.has(nonce))return false;
        nonces.add(nonce);return true;
      }
    });
    const success=result.oneTimeNonceClaimedInLab===true;
    response(res,success?200:409,result.code,{
      oneTimeNonceClaimedInLab:success,
      durableReplayPreventionProven:false,
      captchaOrBotDefenseVerified:false
    });
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      server.removeListener('error',reject);
      resolve();
    });
  });
  return Object.freeze({
    origin:'http://127.0.0.1:'+server.address().port,
    issuePath:ROUTE,verifyPath:ROUTE+'/verify',
    close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))
  });
}
