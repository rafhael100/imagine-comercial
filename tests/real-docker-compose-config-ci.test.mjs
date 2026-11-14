import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('scripts/test-real-docker-compose-config-ci.mjs');
const workflow=read('.github/workflows/validate.yml');

test('F255 CI exercises real docker compose CONFIG parser without container launch or image pull',()=>{
  assert.match(source,/spawnSync\('docker',\[/);
  assert.match(source,/'compose','-f','ops\/staging\/compose\.yaml','config','--format','json'/);
  assert.match(source,/GITHUB_ACTIONS!=='true'/);
  assert.match(source,/IMAGINE_STAGING_NGINX_IMAGE:image/);
  assert.match(source,/IMAGINE_STAGING_HTPASSWD_PATH:authPath/);
  assert.match(source,/reviewEffectivePrivateStagingCompose\(document/);
  assert.match(source,/actualDockerEngineUsed:false/);
  assert.match(source,/imageDownloaded:false/);
  assert.match(source,/deploymentAuthorized:false/);
  assert.doesNotMatch(source,/\bexecSync\(|\bexecFileSync\(|'docker',\s*\[['"](?:run|pull|up)/);
});
test('F255 no real environment, credentials or resolved private paths may be published in CI logs',()=>{
  for(const name of ['IMAGINE_STAGING_REVIEW_PASSWORD','IMAGINE_STAGING_NGINX_IMAGE',
    'IMAGINE_STAGING_HTPASSWD_PATH','IMAGINE_EXPECTED_STAGING_TREE_SHA256'])
    assert.ok(source.includes("'"+name+"'"),name);
  assert.match(source,/Never echo raw resolved JSON/);
  assert.doesNotMatch(source,/console\.log\(run\.stdout\)|console\.error\(run\.stderr\)/);
  assert.match(workflow,/node scripts\/test-real-docker-compose-config-ci\.mjs/);
});
test('F255 local execution without CI authorization rejects and never echoes operator-supplied secrets',()=>{
  const entry=new URL('../scripts/test-real-docker-compose-config-ci.mjs',import.meta.url);
  const secret='F255_OPERATOR_SECRET_NEVER_PRINTED';
  const result=spawnSync(process.execPath,[entry.pathname],{encoding:'utf8',timeout:15000,
    env:{...process.env,GITHUB_ACTIONS:'',IMAGINE_STAGING_REVIEW_PASSWORD:secret}});
  assert.equal(result.status,1);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/effective model contract failed \(NO-GO\)/);
  assert.equal((result.stdout+result.stderr).includes(secret),false);
});
