/**
 * F165 — real built Astro bytes vs current CI review manifest.
 * The digest is derived in THIS EPHEMERAL CI TEST. This is a regression
 * test of byte comparison, NOT independent signature or release approval.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewStagingBuildIntegrity} from '../src/lib/staging-build-integrity.mjs';

const report=JSON.parse(await readFile(
  'artifacts/release-review/REVIEW-ONLY-static-build-sha256.json','utf8'));
assert.equal(report.schema,'imagine.comercial.release-review.v1');
assert.match(report.treeSha256,/^[a-f0-9]{64}$/);
const valid=reviewStagingBuildIntegrity({
  root:'dist',expectedTreeSha256:report.treeSha256
});
assert.equal(valid.fileCount,report.fileCount);
assert.equal(valid.htmlPages,report.htmlPages);
assert.equal(valid.packageBytes,report.totalBytes);
assert.equal(valid.deploymentAuthorized,false);
assert.equal(valid.expectedDigestTrustedIndependently,false);

const temporary=await mkdtemp(join(tmpdir(),'imagine-f165-bytes-ci-'));
try{
  const copyPath=join(temporary,'dist');
  await cp('dist',copyPath,{recursive:true});
  const file=join(copyPath,'index.html');
  const html=await readFile(file);
  assert.ok(html.length>0);
  const changed=Buffer.from(html);
  changed[changed.length-1]^=1;
  await writeFile(file,changed);
  assert.throws(()=>reviewStagingBuildIntegrity({
    root:copyPath,expectedTreeSha256:report.treeSha256
  }),/bytes do not match/);
}finally{
  await rm(temporary,{recursive:true,force:true});
}
console.log('F165: compiled Astro staging tree verified byte-for-byte and tamper rejected (CI-local synthetic pin; NO deploy).');
