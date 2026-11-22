import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewRunningFaiscaPrivateContainer as review }
  from '../ops/faisca/staging/review-running-container.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = '/tmp/faisca-r236-fixture-private-site';
const auth = '/tmp/faisca-r236-fixture-private-bcrypt';
const conf = resolve(root, 'ops/faisca/staging/nginx.conf');
const compose = resolve(root, 'ops/faisca/staging/compose.yaml');
const image = 'nginxinc/nginx-unprivileged@sha256:' + 'ab'.repeat(32);
const project = 'faisca-private';
const bind = (Source, Destination) => ({ Type:'bind',Source,Destination,RW:false });
const hostPort = () => ({ HostIp:'127.0.0.1',HostPort:'4337' });
const params = () => ({
  expectedImage:image,expectedSitePath:site,expectedAuthPath:auth,
  expectedConfigPath:conf,expectedComposePath:compose,expectedWorkingDir:root
});
function fixture() {
  return {
    State:{Running:true,Status:'running',Paused:false,Restarting:false,Dead:false},
    Config:{
      Image:image,User:'101:101',Env:['PATH=/usr/sbin:/usr/bin','TZ=UTC'],
      Labels:{
        'com.docker.compose.project':project,
        'com.docker.compose.service':'faisca-review',
        'com.docker.compose.oneoff':'False',
        'com.docker.compose.project.working_dir':root,
        'com.docker.compose.project.config_files':compose
      }
    },
    HostConfig:{
      PortBindings:{'8080/tcp':[hostPort()]},
      PublishAllPorts:false,Privileged:false,ReadonlyRootfs:true,
      RestartPolicy:{Name:'no'},PidsLimit:64,Memory:268435456,
      NanoCpus:500000000,CapDrop:['ALL'],CapAdd:null,
      SecurityOpt:['no-new-privileges:true'],NetworkMode:project+'_default'
    },
    NetworkSettings:{
      Ports:{'8080/tcp':[hostPort()],'8443/tcp':null},
      Networks:{[project+'_default']:{IPAddress:'172.19.0.2'}}
    },
    Mounts:[
      bind(site,'/usr/share/nginx/html'),
      bind(conf,'/etc/nginx/conf.d/default.conf'),
      bind(auth,'/etc/nginx/auth/.htpasswd')
    ]
  };
}
function attack(change) {
  const inspected = structuredClone(fixture());
  change(inspected);
  assert.throws(() => review({ inspect:inspected,...params() }),/R236|F164/);
}
test('R236 accepts only an operator-supplied matching inspect record with NO deploy authority',()=>{
  const answer = review({inspect:fixture(),...params()});
  assert.equal(answer.status,'DOCKER_INSPECT_FIELDS_MATCH_REVIEW_ONLY');
  assert.equal(answer.reportedLoopbackBinding,true);
  assert.equal(answer.reportedUnprivilegedReadOnlyMounts,true);
  assert.equal(answer.dockerAccessPerformedByThisModule,false);
  assert.equal(answer.actualNetworkExposureIndependentlyVerified,false);
  assert.equal(answer.imageProvenanceVerified,false);
  assert.equal(answer.approvalToDeploy,false);
  assert.equal(answer.publicFaiscaEnabled,false);
  assert.ok(Object.isFrozen(answer));
  for(const secret of [image,site,auth,conf,compose,project])
    assert.equal(JSON.stringify(answer).includes(secret),false);
  const normalized=fixture();
  normalized.Config.Labels['com.docker.compose.project.working_dir']=
    resolve(root,'ops/faisca/staging');
  normalized.HostConfig.SecurityOpt=['no-new-privileges'];
  assert.equal(review({inspect:normalized,...params()}).approvalToDeploy,false);
});
test('R236 fails closed on public/additional Docker host bindings or networks',()=>{
  attack(v=>{v.HostConfig.PortBindings['8080/tcp'][0].HostIp='0.0.0.0';});
  attack(v=>{v.HostConfig.PortBindings['8080/tcp'][0].HostIp='::';});
  attack(v=>{v.HostConfig.PortBindings['8080/tcp'][0].HostPort='8080';});
  attack(v=>{v.HostConfig.PortBindings['80/tcp']=[hostPort()];});
  attack(v=>{v.HostConfig.PublishAllPorts=true;});
  attack(v=>{v.NetworkSettings.Ports['8080/tcp'][0].HostIp='0.0.0.0';});
  attack(v=>{v.NetworkSettings.Ports['8443/tcp']=[hostPort()];});
  attack(v=>{v.NetworkSettings.Ports['8080/tcp'].push(hostPort());});
  attack(v=>{v.HostConfig.NetworkMode='host';});
  attack(v=>{v.HostConfig.NetworkMode='bridge';});
  attack(v=>{v.NetworkSettings.Networks.public={};});
});
test('R236 refuses any actual mount escape or writable override',()=>{
  attack(v=>{v.Mounts[0].RW=true;});
  attack(v=>{v.Mounts[2].RW=true;});
  attack(v=>{v.Mounts[0].Source='/tmp/unreviewed-html';});
  attack(v=>{v.Mounts[1].Source='/tmp/unreviewed-nginx';});
  attack(v=>{v.Mounts[2].Source='/tmp/unreviewed-password';});
  attack(v=>{v.Mounts[0].Type='volume';});
  attack(v=>{v.Mounts[2].Destination='/etc/nginx/conf.d/default.conf';});
  attack(v=>{v.Mounts.push(bind('/var/run/docker.sock','/var/run/docker.sock'));});
  attack(v=>{v.Mounts.pop();});
});
test('R236 refuses privileges, restart, root, leaked environment or weakened limits',()=>{
  attack(v=>{v.State.Running=false;});
  attack(v=>{v.State.Paused=true;});
  attack(v=>{v.Config.Image='nginx:latest';});
  attack(v=>{v.Config.User='0:0';});
  attack(v=>{v.Config.Env.push('OPENAI_API_KEY=SECRET-FIXTURE');});
  attack(v=>{v.HostConfig.Privileged=true;});
  attack(v=>{v.HostConfig.ReadonlyRootfs=false;});
  attack(v=>{v.HostConfig.RestartPolicy.Name='always';});
  attack(v=>{v.HostConfig.PidsLimit=512;});
  attack(v=>{v.HostConfig.Memory=0;});
  attack(v=>{v.HostConfig.NanoCpus=0;});
  attack(v=>{v.HostConfig.CapDrop=[];});
  attack(v=>{v.HostConfig.CapAdd=['NET_ADMIN'];});
  attack(v=>{v.HostConfig.SecurityOpt=['no-new-privileges:true','seccomp:unconfined'];});
});
test('R236 pins expected Compose identity and excludes other services',()=>{
  attack(v=>{v.Config.Labels['com.docker.compose.service']='other';});
  attack(v=>{v.Config.Labels['com.docker.compose.oneoff']='True';});
  attack(v=>{v.Config.Labels['com.docker.compose.project.working_dir']='/tmp/foreign';});
  attack(v=>{v.Config.Labels['com.docker.compose.project.config_files']='/tmp/override.yaml';});
  attack(v=>{v.Config.Labels['com.docker.compose.project']='another';});
  for(const inspect of [null,[],{},'running',{State:null},{Config:null}])
    assert.throws(()=>review({inspect,...params()}),/R236|F164/);
  assert.throws(()=>review({inspect:fixture(),...params(),expectedImage:'nginx:latest'}),/F164|R236/);
  assert.throws(()=>review({inspect:fixture(),...params(),expectedSitePath:'relative'}),/R236/);
  assert.throws(()=>review({inspect:fixture(),...params(),expectedAuthPath:site}),/R236/);
});
test('R236 CLI processes only one bounded operator-supplied inspect JSON, never Docker',()=>{
  const script = fileURLToPath(new URL(
    '../scripts/faisca-review-running-container.mjs',import.meta.url));
  const env = { ...process.env,GITHUB_ACTIONS:'',
    IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW:'1',
    IMAGINE_FAISCA_NGINX_IMAGE:image,
    IMAGINE_FAISCA_STAGING_SITE_DIR:site,
    IMAGINE_FAISCA_STAGING_HTPASSWD_PATH:auth
  };
  const run = (body, other={}) => spawnSync(process.execPath,[script],{
    cwd:root,encoding:'utf8',timeout:15000,input:body,env:{...env,...other}
  });
  const good=run(JSON.stringify([fixture()]));
  assert.equal(good.status,0,good.stderr);
  assert.equal(JSON.parse(good.stdout).approvalToDeploy,false);
  const denied=run(JSON.stringify([fixture()]),{GITHUB_ACTIONS:'true'});
  const many=run(JSON.stringify([fixture(),fixture()]));
  const altered=structuredClone(fixture());altered.HostConfig.Privileged=true;
  const malicious=run(JSON.stringify([altered]));
  const bad=run('{INVALID_JSON SECRET-FIXTURE');
  const tooLarge=run('X'.repeat(256*1024+1));
  for(const result of [denied,many,malicious,bad,tooLarge]){
    assert.equal(result.status,2);
    assert.equal(result.stdout,'');
    assert.match(result.stderr,/not verified \(HOLD\)/);
  }
  for(const result of [good,denied,many,malicious,bad,tooLarge]){
    for(const secret of [image,site,auth,conf,compose,project,'SECRET-FIXTURE'])
      assert.equal((result.stdout+result.stderr).includes(secret),false);
  }
});
