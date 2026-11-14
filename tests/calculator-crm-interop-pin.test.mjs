import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL(
 '../.github/workflows/comercial-calculator-crm-synthetic-interop.yml',import.meta.url),'utf8');
test('F316 CRM interoperability must remain pinned to exact independently reviewed SHA',()=>{
 assert.match(workflow,/repository:\s+rafhael100\/imagine-crm\s+ref:\s+69159795fa47d3362e20649b01d3a8d788875b9c/);
 assert.equal((workflow.match(/persist-credentials:\s+false/g)||[]).length,2);
 assert.match(workflow,/permissions:\s+contents:\s+read/);
 assert.match(workflow,/node scripts\/emit-calculator-interest-fixture-ci\.mjs\s*\|\s*php \.qa\/crm-calculator\/scripts\/ci\/check-calculator-interest-crossrepo\.php/);
 assert.doesNotMatch(workflow,/\b(?:push|schedule|cron):/i);
 assert.doesNotMatch(workflow,/ssh|wrangler deploy|docker compose up|mailgun|sendgrid|api\/leads|secrets\.|pull_request_target/i);
 assert.doesNotMatch(workflow,/repository:\s+rafhael100\/imagine-crm\s+ref:\s+(?:main|dev|v\d+)/);
});
test('F316 synthetic crossrepo QA may never become claim of customer consent or live delivery',()=>{
 assert.match(workflow,/No personal data, tenant authority, real consent, CRM write/);
 assert.match(workflow,/NO-MERGE \/ NO-DEPLOY \/ NO-MARKETING \/ NO-CHARGE/);
 assert.match(workflow,/tests\/synthetic-calculator-interest-interop\.test\.mjs/);
 assert.match(workflow,/tests\/calculator-contact-messages\.test\.mjs/);
});
