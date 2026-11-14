import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {reviewRunningPrivateStagingContainer as review}
  from '../src/lib/running-staging-container-review.mjs';

const root='/srv/imagine-comercial-private';
const auth='/srv/imagine-staging-secrets/reviewer.htpasswd';
const image='nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32));
const project='imagine-review';
const options=()=>({projectRoot:root,expectedAuthPath:auth,expectedImage:image});
const bind=(source,destination)=>({Type:'bind',Source:source,Destination:destination,RW:false});
const connection=()=>({HostIp:'127.0.0.1',HostPort:'4321'});
function synthetic(){
  return {
    State:{Running:true,Status:'running',Paused:false,Restarting:false,Dead:false},
    Config:{
      Image:image,User:'101:101',Env:['PATH=/usr/local/sbin:/usr/local/bin','TZ=UTC'],
      Labels:{
        'com.docker.compose.project':project,
        'com.docker.compose.service':'static-review',
        'com.docker.compose.oneoff':'False',
        'com.docker.compose.project.working_dir':root,
        'com.docker.compose.project.config_files':resolve(root,'ops/staging/compose.yaml')
      }
    },
    HostConfig:{
      PortBindings:{'8080/tcp':[connection()]},
      PublishAllPorts:false,Privileged:false,ReadonlyRootfs:true,
      RestartPolicy:{Name:'no'},PidsLimit:64,Memory:268435456,
      NanoCpus:500000000,CapDrop:['ALL'],CapAdd:null,
      SecurityOpt:['no-new-privileges:true'],
      NetworkMode:project+'_default'
    },
    NetworkSettings:{
      Ports:{'8080/tcp':[connection()],'8443/tcp':null},
      Networks:{[project+'_default']:{IPAddress:'172.19.0.2'}}
    },
    Mounts:[
      bind(resolve(root,'dist'),'/usr/share/nginx/html'),
      bind(resolve(root,'ops/staging/nginx.conf'),'/etc/nginx/conf.d/default.conf'),
      bind(auth,'/etc/nginx/auth/.htpasswd')
    ]
  };
}
function attack(fn){
  const doc=structuredClone(synthetic());
  fn(doc);
  assert.throws(()=>review({inspect:doc,...options()}),/F256|F164/);
}
test('F256 only a running unprivileged, private actual Docker inspect may pass in REVIEW-ONLY',()=>{
  const r=review({inspect:synthetic(),...options()});
  assert.equal(r.status,'RUNNING_CONTAINER_INSPECT_FIELDS_MATCH_REVIEW_ONLY');
  for(const k of ['dockerDaemonStateObserved','runningUnprivilegedContainerObserved',
    'actualLoopbackPortBindingReported','threeReadonlyMountsReported',
    'constrainedDockerPrivilegesReported'])assert.equal(r[k],true,k);
  for(const k of ['networkIsolationIndependentlyVerified','externalTlsAndSshVerified',
    'actualNginxConfigurationAndHttpVerified',
    'imageProvenanceIndependentlyVerified','independentWitnessApproved',
    'productionAuthorized','canCollectLeads','deploymentPerformed'])
    assert.equal(r[k],false,k);
  assert.ok(Object.isFrozen(r));
  for(const secret of [root,auth,image,project,'172.19.0.2'])
    assert.equal(JSON.stringify(r).includes(secret),false);
  const normalized=synthetic();
  normalized.Config.Labels['com.docker.compose.project.working_dir']=resolve(root,'ops/staging');
  normalized.HostConfig.SecurityOpt=['no-new-privileges'];
  assert.equal(review({inspect:normalized,...options()}).productionAuthorized,false);
});
test('F256 rejects a public or additional TCP/IPv6 port at runtime',()=>{
  attack(v=>v.HostConfig.PortBindings['8080/tcp'][0].HostIp='0.0.0.0');
  attack(v=>v.HostConfig.PortBindings['8080/tcp'][0].HostIp='::');
  attack(v=>v.HostConfig.PortBindings['8080/tcp'][0].HostPort='443');
  attack(v=>v.NetworkSettings.Ports['8080/tcp'][0].HostIp='0.0.0.0');
  attack(v=>v.NetworkSettings.Ports['8443/tcp']=[connection()]);
  attack(v=>v.HostConfig.PortBindings['8090/tcp']=[connection()]);
  attack(v=>v.HostConfig.PublishAllPorts=true);
  attack(v=>v.NetworkSettings.Ports['8080/tcp'].push(connection()));
});
test('F256 refuses extra, writable, missing or swapped actual bind mounts',()=>{
  attack(v=>v.Mounts[0].RW=true);
  attack(v=>v.Mounts[2].RW=true);
  attack(v=>v.Mounts[0].Source='/tmp/unreviewed-dist');
  attack(v=>v.Mounts[1].Source='/tmp/unreviewed-nginx.conf');
  attack(v=>v.Mounts[2].Source='/tmp/other-password');
  attack(v=>v.Mounts.push(bind('/tmp/other','/etc/nginx/conf.d/evil.conf')));
  attack(v=>v.Mounts[0].Type='volume');
  attack(v=>v.Mounts[1].Destination='/etc/nginx/nginx.conf');
  attack(v=>v.Mounts.pop());
});
test('F256 refuses root, restart, privilege, writable FS and weakened limits',()=>{
  attack(v=>v.Config.User='0:0');
  attack(v=>v.Config.Image='nginx:latest');
  attack(v=>v.HostConfig.Privileged=true);
  attack(v=>v.HostConfig.ReadonlyRootfs=false);
  attack(v=>v.HostConfig.RestartPolicy.Name='always');
  attack(v=>v.HostConfig.PidsLimit=128);
  attack(v=>v.HostConfig.Memory=0);
  attack(v=>v.HostConfig.NanoCpus=0);
  attack(v=>v.HostConfig.CapAdd=['NET_ADMIN']);
  attack(v=>v.HostConfig.CapDrop=[]);
  attack(v=>v.HostConfig.CapDrop=[null]);
  attack(v=>v.HostConfig.SecurityOpt=['seccomp:unconfined']);
  attack(v=>v.State.Running=false);
  attack(v=>v.State.Paused=true);
  attack(v=>v.State.Restarting=true);
});
test('F256 requires correct Compose owner, service, config and single isolated network',()=>{
  attack(v=>v.Config.Labels['com.docker.compose.project']='other');
  // A different project label without changing the matching network must fail.
  attack(v=>v.Config.Labels['com.docker.compose.service']='other');
  attack(v=>v.Config.Labels['com.docker.compose.oneoff']='True');
  attack(v=>v.Config.Labels['com.docker.compose.project.working_dir']='/tmp/bad');
  attack(v=>v.Config.Labels['com.docker.compose.project.config_files']='/tmp/compose.yaml');
  attack(v=>v.HostConfig.NetworkMode='host');
  attack(v=>v.HostConfig.NetworkMode='bridge');
  attack(v=>v.NetworkSettings.Networks.public={});
  attack(v=>v.NetworkSettings.Networks={public:{}});
  attack(v=>v.Config.Env.push('IMAGINE_STAGING_REVIEW_PASSWORD=SECRET'));
});
test('F256 malformed daemon response and unapproved local expectations fail closed',()=>{
  for(const inspect of [null,{},[],{State:null},{Config:null},'running']){
    assert.throws(()=>review({inspect,...options()}),/F256|F164/);
  }
  assert.throws(()=>review({inspect:synthetic(),...options(),expectedImage:'nginx:latest'}),/F164/);
  assert.throws(()=>review({inspect:synthetic(),...options(),projectRoot:'relative/path'}),/F256/);
  assert.throws(()=>review({inspect:synthetic(),...options(),expectedAuthPath:root+'/inside'}),/F256/);
});
test('F256 CLI is read-only operator-only and refuses CI without executing Docker',()=>{
  const cli=new URL('../scripts/inspect-running-private-staging.mjs',import.meta.url);
  const source=readFileSync(cli,'utf8');
  assert.match(source,/reviewPrivateStagingConfiguration\(/);
  assert.match(source,/reviewEffectivePrivateStagingCompose\(/);
  assert.match(source,/reviewRunningPrivateStagingContainer\(/);
  assert.match(source,/'ps','-q','static-review'/);
  assert.match(source,/'inspect','--type','container'/);
  assert.doesNotMatch(source,/['"](?:up|run|start|stop|restart|rm|pull|push|exec)['"]/);
  const secret='F256_PRIVATE_SECRET_MUST_NOT_PRINT_2026';
  const run=spawnSync(process.execPath,[cli.pathname],{encoding:'utf8',timeout:15000,
    env:{...process.env,GITHUB_ACTIONS:'true',
      IMAGINE_PRIVATE_STAGING_REVIEW:'1',
      IMAGINE_STAGING_REVIEW_PASSWORD:secret}});
  assert.equal(run.status,2);
  assert.equal(run.stdout,'');
  assert.match(run.stderr,/not verified \(HOLD\)/);
  assert.doesNotMatch(run.stdout+run.stderr,new RegExp(secret));
});
