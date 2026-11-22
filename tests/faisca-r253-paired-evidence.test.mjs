import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewFaiscaPrivatePairedEvidence as review }
  from '../ops/faisca/staging/review-private-paired-evidence.mjs';

const cli=fileURLToPath(new URL('../scripts/faisca-review-paired-staging.mjs',import.meta.url));
const image='nginxinc/nginx-unprivileged@sha256:'+'ab'.repeat(32);
const configId='sha256:'+'cd'.repeat(32);
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const onePort=port=>({HostIp:'127.0.0.1',HostPort:String(port)});
function fixture(port) {
  return {
    container:[{
      Image:configId, State:{Running:true,Status:'running'},
      Config:{Image:image,User:'101:101',Labels:{
        'com.docker.compose.project':'faisca-private',
        'com.docker.compose.service':'faisca-review',
        'com.docker.compose.oneoff':'False'
      }},
      HostConfig:{Privileged:false,PublishAllPorts:false,
        NetworkMode:'faisca-private_default',
        PortBindings:{'8080/tcp':[onePort(port)]}},
      NetworkSettings:{Ports:{'8080/tcp':[onePort(port)],'8443/tcp':null},
        Networks:{'faisca-private_default':{}}}
    }],
    image:[{Id:configId,RepoDigests:[image],Os:'linux',Architecture:'amd64'}]
  };
}
function headers(frame) {
  return {
    'WWW-Authenticate':'Basic realm="Imagine Faísca private review"',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options':frame?'SAMEORIGIN':'DENY',
    'Content-Security-Policy':CSP+(frame?"'self'":"'none'"),
    'Content-Type':'text/html',Server:'nginx'
  };
}
async function server(t,mutate=()=>{}) {
  const visits=[];
  const s=createServer((req,res)=>{
    visits.push({url:req.url,headers:req.headers,method:req.method});
    const frame=['/__faisca_preview/journey/','/__faisca_preview/support/'].includes(req.url);
    const reply={code:401,headers:headers(frame),body:'401 Authorization Required'};
    mutate(reply,req);
    res.writeHead(reply.code,reply.headers);
    res.end(reply.body);
  });
  await new Promise((resolve,reject)=>{
    s.once('error',reject);s.listen(0,'127.0.0.1',resolve);
  });
  t.after(async()=>{
    s.closeAllConnections();
    await new Promise(resolve=>s.close(resolve));
  });
  return {port:s.address().port,visits};
}
async function invoke(port,input,overrides={},args=['--port',String(port)]) {
  const env={...process.env,GITHUB_ACTIONS:'',
    IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW:'1',
    IMAGINE_FAISCA_NGINX_IMAGE:image,...overrides};
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,...args],{env,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',v=>{stdout+=v.toString();});
    child.stderr.on('data',v=>{stderr+=v.toString();});
    child.stdin.on('error',()=>{});
    child.once('error',reject);
    child.once('close',code=>resolve({code,stdout,stderr}));
    child.stdin.end(input);
  });
}
const expectHold=r=>{
  assert.equal(r.code,2,r.stderr);
  assert.equal(r.stdout,'');
  assert.equal(r.stderr,'R253: paired private staging evidence unverified (HOLD)\n');
};
test('R253 correlates reported immutable image, fixed local binding and 19 real no-auth HTTP probes',async t=>{
  const {port,visits}=await server(t);
  const data=fixture(port);
  const out=await review({container:data.container[0],
    image:data.image[0],expectedImage:image,port});
  assert.equal(out.noAuthHttpProbesPassed,19);
  assert.equal(out.reportedDockerPortMatchesProbedLoopbackPort,true);
  assert.equal(out.dockerInspectionPerformed,false);
  assert.equal(out.dockerToHttpProcessOwnershipIndependentlyVerified,false);
  assert.equal(out.containerRuntimePolicyFullyVerified,false);
  assert.equal(out.registryProvenanceIndependentlyVerified,false);
  assert.equal(out.publicReady,false);
  assert.equal(out.publicFaiscaEnabled,false);
  assert.equal(out.deploymentAuthorized,false);
  assert.ok(Object.isFrozen(out));
  const cmd=await invoke(port,JSON.stringify(data));
  assert.equal(cmd.code,0,cmd.stderr);
  const report=JSON.parse(cmd.stdout);
  assert.equal(report.noAuthHttpProbesPassed,19);
  assert.equal(report.reviewedDefaultStagingPort,port===4337);
  assert.equal(report.providerSpendReconciled,false);
  assert.equal(report.authenticatedConversationVerified,false);
  assert.equal(visits.length,38);
  assert.ok(visits.every(v=>v.headers.authorization===undefined &&
    v.headers.cookie===undefined && v.headers.host==='127.0.0.1:'+port));
  for(const output of [cmd.stdout,cmd.stderr]){
    for(const secret of [configId,image,'faisca-private']) assert.ok(!output.includes(secret));
  }
});
test('R253 rejects mismatched Docker port, public binding and unreviewed container/image claims before HTTP',async t=>{
  const {port,visits}=await server(t);
  const changes=[
    f=>{f.container[0].HostConfig.PortBindings['8080/tcp'][0].HostPort='9999';},
    f=>{f.container[0].HostConfig.PortBindings['8080/tcp'][0].HostIp='0.0.0.0';},
    f=>{f.container[0].NetworkSettings.Ports['8080/tcp'][0].HostIp='::';},
    f=>{f.container[0].NetworkSettings.Ports['443/tcp']=[onePort(port)];},
    f=>{f.container[0].HostConfig.PortBindings['80/tcp']=[onePort(port)];},
    f=>{f.container[0].HostConfig.PublishAllPorts=true;},
    f=>{f.container[0].State.Running=false;},
    f=>{f.container[0].Config.User='0:0';},
    f=>{f.container[0].Config.Labels['com.docker.compose.service']='other';},
    f=>{f.container[0].Image='sha256:'+'ef'.repeat(32);},
    f=>{f.image[0].RepoDigests=['nginxinc/nginx-unprivileged@sha256:'+'ef'.repeat(32)];}
  ];
  for(const change of changes) {
    const data=fixture(port);change(data);
    const out=await invoke(port,JSON.stringify(data));
    expectHold(out);
    assert.ok(!out.stderr.includes('sha256:'));
  }
  assert.equal(visits.length,0);
});
test('R253 never emits partial positive evidence if one HTTP alias bypasses auth',async t=>{
  const {port,visits}=await server(t,(reply,req)=>{
    if(req.url==='/__faisca_preview/journey/index.html'){
      reply.code=200;reply.body='SECRET-FIXTURE-HTML';
    }
  });
  const result=await invoke(port,JSON.stringify(fixture(port)));
  expectHold(result);
  assert.ok(visits.some(x=>x.url==='/__faisca_preview/journey/index.html'));
  assert.ok(!result.stderr.includes('SECRET-FIXTURE-HTML'));
});
test('R253 rejects CI, missing private guard, invalid pin, malformed input and remote arguments',async t=>{
  const {port,visits}=await server(t);
  const body=JSON.stringify(fixture(port));
  for(const result of [
    await invoke(port,body,{GITHUB_ACTIONS:'true'}),
    await invoke(port,body,{IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW:''}),
    await invoke(port,body,{IMAGINE_FAISCA_NGINX_IMAGE:'nginx:latest'}),
    await invoke(port,'{INVALID SECRET-FIXTURE'),
    await invoke(port,JSON.stringify({...fixture(port),secret:'SECRET-FIXTURE'})),
    await invoke(port,body,{},['--url','https://example.invalid']),
    await invoke(port,body,{},['--host','example.invalid'])
  ]) expectHold(result);
  assert.equal(visits.length,0);
});
