import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

function run(file,args,extra={}){
 return spawnSync(process.execPath,[file,...args],{
  cwd:resolve('.'),encoding:'utf8',timeout:7000,
  env:{...process.env,GITHUB_ACTIONS:'true',IMAGINE_LEGACY_HTTP_REVIEW:'1',
   IMAGINE_STAGING_REVIEW_PASSWORD:'SECRET_CANNOT_ESCAPE_'+
     'correct-horse-battery-staple',...extra}
 });
}
test('F310 neither operator HTTP capture nor evidence comparison can execute inside GitHub Actions',()=>{
 for(const [file,args] of [
  ['scripts/capture-legacy-http-operator.mjs',
   ['--original','/tmp/legacy-before-f310.json']],
  ['scripts/capture-legacy-http-operator.mjs',
   ['--candidate-local','/tmp/legacy-after-f310.json']],
  ['scripts/review-legacy-http-operator.mjs',
   ['--before','/tmp/legacy-before-f310.json',
    '--after','/tmp/legacy-after-f310.json']]
 ]){
  const result=run(file,args);
  assert.equal(result.status,2,file);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/HOLD/);
  assert.doesNotMatch(result.stderr,/SECRET_CANNOT_ESCAPE|\/tmp\/|legacy-before|correct-horse/);
 }
});
test('F310 operator tools reject disabled/invalid invocation before any HTTP or read',()=>{
 for(const file of [
  'scripts/capture-legacy-http-operator.mjs',
  'scripts/review-legacy-http-operator.mjs'
 ]){
  const result=run(file,[],{GITHUB_ACTIONS:'false',
   IMAGINE_LEGACY_HTTP_REVIEW:'0'});
  assert.equal(result.status,2,file);
  assert.match(result.stderr,/HOLD/);
  assert.equal(result.stdout,'');
 }
});
