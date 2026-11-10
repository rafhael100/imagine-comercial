/**
 * F95: LOCAL-ONLY consumer-driven HTTP contract test fixture.
 *
 * This is NOT part of the Portal or CRM server, and MUST NOT be deployed,
 * imported by Astro pages, or interpreted as a production receiver. It never
 * stores personal data, receives real contacts, or reaches another service.
 * Every status, including HTTP 202, means ONLY lab metadata was seen.
 */
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {inspectSyntheticCrmEnvelopeV1}
  from '../../src/lib/crm-envelope-v1-compat-lab.mjs';

const path='/__lab/internal/lead-review';
const limit=2048;
const fixed=Object.freeze({
  organization_reference:'11111111-1111-4111-8111-111111111111',
  binding_reference:'22222222-2222-4222-8222-222222222222',
  site_reference:'44444444-4444-4444-8444-444444444444',
  form_reference:'55555555-5555-4555-8555-555555555555',
  destination_reference:'66666666-6666-4666-8666-666666666666'
});
const neverAcknowledged=Object.freeze({
  crmPersisted:false,tenantAuthenticatedForProduction:false,
  visitorAcknowledgementAllowed:false,deliveryProven:false
});
function same(a,b){return a.toLowerCase()===b.toLowerCase();}
function reply(res,status,reasonCode){
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  });
  res.end(JSON.stringify({
    schema:'imagine.comercial.loopback-intake-contract.v1',
    reasonCode,mode:'LAB_ONLY_VOLATILE_NO_CRM_DELIVERY',
    ...neverAcknowledged
  }));
}
function tokenMatches(auth,expected){
  if(typeof auth!=='string')return false;
  const supplied=Buffer.from(auth,'utf8');
  const other=Buffer.from('Bearer '+expected,'utf8');
  return supplied.length===other.length&&timingSafeEqual(supplied,other);
}

export async function startPrivateLoopbackIntakeHarness({observeMetadata=null}={}){
  if(observeMetadata!==null&&typeof observeMetadata!=='function')
    throw new Error('F96: synthetic observation adapter must be a function');

  // Credentials exist only in this test process and are never logged or saved.
  const ephemeralKey=randomBytes(32).toString('hex');
  const recorded=new Set();
  const server=createServer(async (req,res)=>{
    try{
      if(req.socket.localAddress!=='127.0.0.1'){
        reply(res,403,'LOOPBACK_ONLY');
        return;
      }
      if(req.url!==path||req.method!=='POST'){
        reply(res,404,'NO_PUBLIC_ROUTE');
        return;
      }
      if(!tokenMatches(req.headers.authorization,ephemeralKey)){
        reply(res,401,'SYNTHETIC_SERVICE_AUTH_REQUIRED');
        return;
      }
      if(req.headers['content-type']!=='application/json'){
        reply(res,415,'JSON_CONTENT_TYPE_REQUIRED');
        return;
      }
      const announced=Number(req.headers['content-length']);
      if(req.headers['content-length']!==undefined&&
         (!Number.isSafeInteger(announced)||announced<0||announced>limit)){
        reply(res,413,'SYNTHETIC_BODY_LIMIT');
        return;
      }
      let total=0;
      const chunks=[];
      for await(const part of req){
        total+=part.byteLength;
        if(total>limit){
          reply(res,413,'SYNTHETIC_BODY_LIMIT');
          return;
        }
        chunks.push(part);
      }
      let body;
      try{
        body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }catch{
        reply(res,400,'INVALID_JSON');
        return;
      }
      const contract=inspectSyntheticCrmEnvelopeV1(body);
      if(!contract.isStructurallyCompatible){
        reply(res,422,'METADATA_ENVELOPE_REJECTED');
        return;
      }
      if(!Object.entries(fixed).every(([key,value])=>same(body[key],value))){
        reply(res,403,'UNTRUSTED_BINDING_CONTEXT');
        return;
      }
      // No client-provided tenant grants authority: the server-fixed context
      // is mandatory, even though this test is NOT a real identity provider.
      const id=body.organization_reference.toLowerCase()+'|'+
        body.submission_reference.toLowerCase();
      let existed;
      if(observeMetadata!==null){
        // Integration tests inject a PostgreSQL-backed adapter. Never connect
        // to a database here; the fixture itself is not a production service.
        const outcome=await observeMetadata(body);
        if(outcome!=='new'&&outcome!=='duplicate'){
          reply(res,503,'LAB_METADATA_NOT_CONFIRMED');
          return;
        }
        existed=outcome==='duplicate';
      }else{
        existed=recorded.has(id);
        if(!existed)recorded.add(id);
      }
      reply(res,202,existed?'DUPLICATE_SYNTHETIC_METADATA':
        'FIRST_SYNTHETIC_METADATA_OBSERVATION');
    }catch{
      // Never expose input fields, auth headers, network errors or PII.
      if(!res.headersSent)reply(res,500,'LAB_INTERNAL_FAILURE_NO_ACK');
      else res.end();
    }
  });
  try{
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
  }catch(error){
    server.close();
    throw error;
  }
  const address=server.address();
  if(typeof address!=='object'||address.address!=='127.0.0.1'){
    server.close();
    throw new Error('F95: loopback listener required');
  }
  return Object.freeze({
    url:'http://127.0.0.1:'+address.port+path,
    testOnlyBearer:ephemeralKey,
    recordedCount:()=>recorded.size,
    close:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))
  });
}
