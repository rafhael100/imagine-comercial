import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const workflowsDir=new URL('../.github/workflows/',import.meta.url);
const workflows=readdirSync(workflowsDir)
  .filter(name=>/\.ya?ml$/.test(name))
  .map(name=>({name,source:readFileSync(new URL(name,workflowsDir),'utf8')}));
const repoRoot=new URL('../',import.meta.url);

test('P0 integration CI uses read-only tokens and does not persist checkout credentials',()=>{
  assert.ok(workflows.length>=3,'Expected all three QA workflows');
  for(const {name,source} of workflows){
    assert.match(source,/^permissions:\s*\n\s+contents: read\s*$/m,
      name+' must declare read-only contents permission');
    assert.doesNotMatch(source,/^\s*(?:contents|id-token|deployments|packages|actions):\s*write\s*$/mi,
      name+' requests a write capability');
    const steps=source.split(/(?=^\s+- name:)/m);
    const checkout=steps.filter(part=>/^\s*uses:\s*actions\/checkout@/m.test(part));
    assert.ok(checkout.length>0,name+' must checkout source code');
    for(const step of checkout){
      assert.match(step,/^\s*persist-credentials:\s*false\s*$/m,
        name+' must not persist checkout credentials');
    }
  }
});

test('P0 review workflows contain no cloud deployment or publishing actions',()=>{
  const risky=/cloudflare\/(?:wrangler-action|pages-action)|actions\/deploy-pages|(?:^|\s)(?:npx\s+)?wrangler\s+(?:deploy|publish|pages\s+deploy)\b|(?:^|\s)npm\s+run\s+deploy\b|aws-actions\/configure-aws-credentials|azure\/login@|google-github-actions\/auth@/mi;
  for(const {name,source} of workflows){
    assert.doesNotMatch(source,risky,name+' must remain an offline review workflow');
  }
});

test('P0 review never commits Cloudflare operational redirect rules or default deploy config',()=>{
  for(const path of ['public/_redirects','public/_headers','dist/_redirects',
    'dist/_headers','wrangler.json','wrangler.toml','wrangler.jsonc']){
    assert.equal(existsSync(new URL(path,repoRoot)),false,
      'Found prohibited operational deployment artifact: '+path);
  }
  const config=JSON.parse(readFileSync(new URL('config/wrangler-static-assets-candidate.json',repoRoot),'utf8'));
  assert.equal(config.workers_dev,false);
  assert.match(config.$comment,/REVIEW ONLY/i);
});
