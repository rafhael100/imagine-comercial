/**
 * P0 F161 — private, test-only HTTP transport for the Budget→CRM review
 * code. Not referenced by Astro, production runtimes or public routes.
 * An authenticated 200 response is diagnostic only: NEVER a CRM receipt.
 */
import {createServer} from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {issuePrivateBudgetRequestProofLab,inspectPrivateBudgetRequestProofLab}
  from '../../src/lib/private-budget-request-proof-lab.mjs';
import {reviewPrivateBudgetToCrmLab} from '../../src/lib/private-budget-crm-review.mjs';

const ROUTE='/__lab/budget/structural-review';
const PROOF_ROUTE='/__lab/budget/request-proof';
const PROOF_SCOPE='synthetic-private-review-session';
const MAX_BODY=4096;
const headers=Object.freeze({
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'"
});
const digest=value=>createHash('sha256').update(value,'utf8').digest();
function allowedBasic(header,expected){
  if(typeof header!=='string'||header.length>400||
     !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header))return false;
  const raw=header.slice(6),bytes=Buffer.from(raw,'base64');
  if(bytes.toString('base64')!==raw)return false;
  return timingSafeEqual(digest(bytes.toString('utf8')),expected);
}
function write(res,status,payload){
  res.statusCode=status;
  res.end(JSON.stringify(payload));
}
function refusal(code){
  return {schema:'imagine.comercial.private-budget-http-review.v1',
    mode:'LAB_DENY_ONLY',code,canAcknowledgeVisitor:false,canSendToCrm:false};
}
export async function startPrivateBudgetReviewLab(password,{requireRequestProof=false,claimNonce=null}={}){
  if(typeof password!=='string'||password.length<24||password.length>128||
      !/^[\x21-\x7e]+$/.test(password))
    throw new Error('F161: a strong local-only password is required');
  if(typeof requireRequestProof!=='boolean'||
     (claimNonce!==null&&(!requireRequestProof||typeof claimNonce!=='function')))
    throw Error('F180: invalid private request proof adapter policy');
  const expected=digest('reviewer:'+password);
  const proofKey=requireRequestProof?randomBytes(32):null;
  const usedNonces=new Set();
  let issuedCount=0;
  const server=createServer(async(req,res)=>{
    for(const [key,value] of Object.entries(headers))res.setHeader(key,value);
    const socket=server.address();
    if(!socket||typeof socket!=='object'||req.headers.host!=='127.0.0.1:'+socket.port){
      write(res,421,refusal('INVALID_HOST'));return;
    }
    if(!allowedBasic(req.headers.authorization,expected)){
      res.setHeader('WWW-Authenticate','Basic realm="Imagine lab", charset="UTF-8"');
      write(res,401,refusal('AUTHENTICATION_REQUIRED'));return;
    }
    if(requireRequestProof&&req.method==='GET'&&req.url===PROOF_ROUTE){
      // F181: refuse cross-origin issuance even when a browser supplies
      // cached Basic credentials. Missing Origin is allowed for CLI CI tests;
      // Fetch Metadata must not explicitly identify a cross-site caller.
      const expectedOrigin='http://127.0.0.1:'+socket.port;
      if((req.headers.origin!==undefined&&req.headers.origin!==expectedOrigin)||
         (req.headers['sec-fetch-site']!==undefined&&
          !['same-origin','none'].includes(req.headers['sec-fetch-site']))){
        write(res,403,refusal('PROOF_ISSUANCE_ORIGIN_DENIED'));return;
      }
      if(issuedCount>=256){
        write(res,429,refusal('LAB_REPLAY_STORAGE_CAP_REACHED'));return;
      }
      issuedCount++;
      const issued=issuePrivateBudgetRequestProofLab({
        key:proofKey,origin:'http://127.0.0.1:'+socket.port,
        scope:PROOF_SCOPE
      });
      write(res,200,{
        ...refusal('SIGNED_ONE_TIME_LAB_PROOF_ISSUED'),
        requestProof:issued.token,ttlSeconds:issued.ttlSeconds
      });return;
    }
    if(req.method!=='POST'){
      res.setHeader('Allow','POST');
      write(res,405,refusal('METHOD_NOT_ALLOWED'));return;
    }
    if(req.url!==ROUTE){write(res,404,refusal('NOT_FOUND'));return;}
    if(req.headers.origin!=='http://127.0.0.1:'+socket.port){
      write(res,403,refusal('UNTRUSTED_ORIGIN'));return;
    }
    if(!/^application\/json(?:; charset=utf-8)?$/i.test(req.headers['content-type']||'')){
      write(res,415,refusal('UNSUPPORTED_MEDIA_TYPE'));return;
    }
    // F182: reject encoded or declared oversize bodies before buffering.
    // Streaming size checks below remain mandatory for chunked/lying clients.
    if(req.headers['content-encoding']!==undefined&&
       req.headers['content-encoding']!=='identity'){
      write(res,415,refusal('UNSUPPORTED_CONTENT_ENCODING'));return;
    }
    const declared=req.headers['content-length'];
    if(declared!==undefined&&(!/^(?:0|[1-9][0-9]*)$/.test(declared)||
       Number(declared)>MAX_BODY)){
      write(res,413,refusal('BODY_TOO_LARGE'));return;
    }
    let total=0,oversize=false;
    const chunks=[];
    try{
      for await(const chunk of req){
        total+=chunk.length;
        if(total>MAX_BODY){oversize=true;continue;}
        chunks.push(chunk);
      }
    }catch{
      if(!res.writableEnded)write(res,400,refusal('BODY_UNREADABLE'));
      return;
    }
    if(oversize){write(res,413,refusal('BODY_TOO_LARGE'));return;}
    let input;
    try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
    catch{write(res,400,refusal('INVALID_JSON'));return;}
    if(requireRequestProof){
      const required=['privateDraft','envelope','storedSnapshot','expectedVersion','requestProof'];
      if(!input||Array.isArray(input)||typeof input!=='object'||
        Object.keys(input).length!==required.length||
        !required.every(k=>Object.hasOwn(input,k))){
        write(res,422,refusal('PROOF_GATED_BODY_SHAPE_REQUIRED'));return;
      }
      const inspected=await inspectPrivateBudgetRequestProofLab({
        key:proofKey,token:input.requestProof,
        origin:'http://127.0.0.1:'+socket.port,scope:PROOF_SCOPE,
        claimNonce:claimNonce??((nonce)=>{
          if(usedNonces.size>=256||usedNonces.has(nonce))return false;
          usedNonces.add(nonce);return true;
        })
      });
      if(inspected.oneTimeNonceClaimedInLab!==true){
        write(res,409,refusal('SIGNED_REQUEST_PROOF_REQUIRED_OR_USED'));return;
      }
      const {requestProof, ...reviewInput}=input;
      input=reviewInput;
    }
    const result=reviewPrivateBudgetToCrmLab(input);
    write(res,200,{
      schema:'imagine.comercial.private-budget-http-review.v1',
      mode:'LAB_DIAGNOSTIC_NOT_RECEIPT',
      stage:result.stage,reasonCode:result.reasonCode,
      canAcknowledgeVisitor:false,canSendToCrm:false,
      canDeploy:false
    });
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      server.removeListener('error',reject);resolve();
    });
  });
  return Object.freeze({
    url:'http://127.0.0.1:'+server.address().port+ROUTE,
    close:()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))
  });
}
