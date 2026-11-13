/**
 * F210: executable end-to-end QA of a separately pinned SEO F96 CLI.
 * All query strings and files in this fixture are SYNTHETIC, never customers.
 */
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const cli=resolve('.qa/seo-rc38-f96/scripts/prepare-portal-gsc-csv-handoff-offline.mjs');
assert.ok(existsSync(cli),'F210: fixed SEO CLI checkout required');
const dir=mkdtempSync(join(tmpdir(),'imagine-f210-'));
const csvHeader='Queries,Clicks,Impressions,CTR,Position\n';
const publicTerm='landing pages profissionais';
const disguised='pessoa＠example.com';
const manifest={
 auditFile:'audit.json',
 previous:{file:'before.csv',startDate:'2026-10-01',endDate:'2026-10-07'},
 current:{file:'after.csv',startDate:'2026-10-08',endDate:'2026-10-14'},
 scope:{tenantRef:'imagine-demo',
   propertyFingerprint:'a'.repeat(64),sourceRevision:'b'.repeat(40)}
};
const manifestFile=join(dir,'manifest.json');
const writeManifest=value=>writeFileSync(manifestFile,JSON.stringify(value));
const run=()=>spawnSync(process.execPath,[cli,manifestFile],{
 encoding:'utf8',timeout:15000,maxBuffer:1024*1024
});
try{
 writeFileSync(join(dir,'audit.json'),JSON.stringify({
  summary:{pages:2,errors:1,warnings:0},
  errors:[{type:'wrong_canonical',file:'SYNTHETIC-PRIVATE-PATH.html',
    message:'SYNTHETIC-PRIVATE-MESSAGE'}],warnings:[]
 }));
 writeFileSync(join(dir,'before.csv'),
  csvHeader+'"'+publicTerm+'",30,300,10%,8\n');
 writeManifest(manifest);
 // A public-only pair is usable for operator review, never authorized display.
 writeFileSync(join(dir,'after.csv'),
  csvHeader+'"'+publicTerm+'",8,200,4%,8\n');
 const allowed=run();
 assert.equal(allowed.status,0,'F210 public fixture must review');
 const a=JSON.parse(allowed.stdout);
 assert.equal(a.coverage.metricsWithheld,false);
 assert.equal(a.handoff.organic.previous.clicks,30);
 assert.equal(a.handoff.organic.current.clicks,8);
 assert.equal(a.handoff.customerDisplayAuthorized,false);
 assert.equal(a.releaseStatus,'HOLD_EXTERNAL_AUTHORIZATION');
 // One Unicode-masked private term suppresses *all* organic signals.
 writeFileSync(join(dir,'after.csv'),
  csvHeader+'"'+publicTerm+'",8,200,4%,8\n'+
  '"'+disguised+'",1,100,1%,8\n');
 const withheld=run();
 assert.equal(withheld.status,0,'F210 privacy-suppressed fixture must review');
 const b=JSON.parse(withheld.stdout);
 assert.equal(b.coverage.metricsWithheld,true);
 assert.equal(b.coverage.redactedRows,1);
 assert.equal(b.brief.organic,null);
 assert.equal(b.handoff.organic,null);
 assert.deepEqual(b.handoff.suggestedReviews.map(x=>x.code),
  ['repair_canonical']);
 assert.equal(b.handoff.customerDisplayAuthorized,false);
 assert.equal(b.handoff.publicationAuthorized,false);
 assert.equal(b.networkPerformed,false);
 assert.equal(b.releaseStatus,'HOLD_EXTERNAL_AUTHORIZATION');
 for(const secret of [disguised,'SYNTHETIC-PRIVATE-PATH',
   'SYNTHETIC-PRIVATE-MESSAGE',dir])
   assert.ok(!withheld.stdout.includes(secret),'F210 leaked private fixture content');
 // File references are constrained to manifest's own trusted directory.
 writeManifest({...manifest,previous:{...manifest.previous,file:'../before.csv'}});
 const rejected=run();
 assert.equal(rejected.status,2);
 assert.equal(rejected.stdout,'');
 assert.ok(!rejected.stderr.includes(dir));
 assert.ok(!rejected.stderr.includes(disguised));
 console.log('F210: F96 CSV-to-Portal CLI positive, private, escape gates PASS; NO-GO');
}finally{rmSync(dir,{recursive:true,force:true});}
