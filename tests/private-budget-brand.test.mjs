import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('./fixtures/private-contact-form-preview.html',import.meta.url),'utf8');
const original=readFileSync(new URL('../public/logo-imagine.png',import.meta.url));

test('F266 private quote preview embeds exact original Imagine logo without network',()=>{
  const match=html.match(/<img class="brand-mark" src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(match,'the original logomark must be embedded locally');
  const decoded=Buffer.from(match[1],'base64');
  assert.deepEqual(decoded,original,'preview and public site must use identical approved logo');
  assert.ok(!html.includes('<script'));
});

test('F266 synthetic quote preview keeps warm Imagine visual tokens and no submit',()=>{
  for(const token of ['#f9941d','#171b19','#f7f7f8','#b45b00','#56534e'])
    assert.ok(html.includes(token),'expected Imagine palette token '+token);
  for(const legacy of ['#1e293b','#f5f7fa','#abb8c8','#6d809a','#005a9c','#41546b','#596a7c'])
    assert.ok(!html.includes(legacy),'legacy blue token '+legacy);
  assert.match(html,/<button type="submit" disabled/);
  assert.match(html,/method="dialog"/);
  assert.match(html,/noindex,nofollow/);
});
