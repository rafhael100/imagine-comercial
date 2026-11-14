import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RELEASE_GATES,evaluateLaunchReadiness} from '../src/lib/launch-readiness.mjs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';

const id='legacy-contact-intake-parity';
test('F70: public form replacement needs a separate release gate even if others are reviewed',()=>{
 assert.ok(RELEASE_GATES.includes(id));
 const evidence='https://github.com/rafhael100/imagine-comercial/issues/56';
 const gates=RELEASE_GATES.filter(x=>x!==id).map(x=>({
  id:x,status:'reviewed',evidenceUrls:[evidence]
 }));
 const result=evaluateLaunchReadiness({gates});
 assert.deepEqual(result.unresolved,[id]);
 assert.equal(result.state,'BLOCKED_REVIEW_ONLY');
 assert.equal(result.deploymentAuthorized,false);
 assert.equal(result.deploymentPerformed,false);
});
test('F70: actual preview has no operational lead form, so route to contact only',()=>{
 const page=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
 assert.doesNotMatch(page,/<form\b|<input\b|fetch\(|XMLHttpRequest|sendBeacon\(/);
 assert.match(page,/id="contact-whatsapp"/);
 assert.match(page,/id="contact-email"/);
 assert.match(page,/O formulário integrado ao Portal será disponibilizado após homologação/);
 const report=JSON.parse(renderReadinessReport([]));
 assert.ok(report.blockers.includes(id));
 assert.equal(report.approval,'NOT_AUTHORIZED');
});
test('F70: metadata cannot silently claim conversion parity was already approved',()=>{
 const result=evaluateLaunchReadiness({gates:[{
  id,status:'blocked',evidenceUrls:[]
 }]});
 assert.ok(result.unresolved.includes(id));
 assert.equal(result.deploymentAuthorized,false);
 assert.throws(()=>evaluateLaunchReadiness({gates:[{
  id,status:'ready',evidenceUrls:[]
 }]}),/invalid/);
});
