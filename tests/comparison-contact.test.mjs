import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comparisonOptions} from '../src/data/service-comparison.mjs';
import {composeReviewedComparisonContact as compose} from '../src/data/comparison-contact.mjs';
import {contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';

test('F188 all fifteen approved pairs produce stable external channel URLs',()=>{
  const urls=new Set();
  for(let i=0;i<comparisonOptions.length;i++)
  for(let j=i+1;j<comparisonOptions.length;j++){
    const a=comparisonOptions[i],b=comparisonOptions[j];
    const pair=compose([a.slug,b.slug]);
    assert.deepEqual(pair,compose([b.slug,a.slug]));
    assert.ok(Object.isFrozen(pair));
    assert.ok(pair.message.includes(a.label)&&pair.message.includes(b.label));
    assert.ok(pair.subject.includes(a.label)&&pair.subject.includes(b.label));
    assert.ok(pair.message.length<=280&&pair.subject.length<=120);
    const whatsapp=contactWhatsAppUrl(pair.message);
    const email=contactEmailUrl(pair.subject,pair.message);
    assert.match(whatsapp,/^https:\/\/wa\.me\/5585996632689\?text=/);
    assert.match(email,/^mailto:imagine@imaginecomunicacao\.com\.br\?subject=/);
    urls.add(whatsapp);
  }
  assert.equal(urls.size,15);
});
test('F188 rejects all unreviewed input and free-text outbound messages',()=>{
  for(const pair of [null,{},[],['onepage'],['onepage','onepage'],
    ['onepage','https://evil.invalid'],['onepage','a@b.invalid'],
    ['onepage','landing-pages','extra'],['onepage',null]]){
    assert.throws(()=>compose(pair),/exactly two different approved services/);
  }
  assert.throws(()=>contactWhatsAppUrl('unreviewed message'),/outside curated intent/);
  assert.throws(()=>contactEmailUrl('unreviewed subject','unreviewed body'),/outside curated intent/);
});
test('F188 contacts are hidden without JS or selection and never perform intake',()=>{
  const source=readFileSync(new URL('../src/pages/comparar-solucoes.astro',import.meta.url),'utf8');
  assert.match(source,/id="contact-comparison-whatsapp"[^>]*href="\/contato\/"/);
  assert.match(source,/id="contact-comparison-email"[^>]*href="\/contato\/"/);
  assert.match(source,/pairWhatsApp\.hidden=!pairReady/);
  assert.match(source,/pairEmail\.hidden=!pairReady/);
  assert.match(source,/contactWhatsAppUrl\(text\.message\)/);
  assert.match(source,/contactEmailUrl\(text\.subject,text\.message\)/);
  assert.match(source,/pairWhatsApp\.removeAttribute\('href'\)/);
  assert.doesNotMatch(source,/<form\b|<input\b|<textarea\b|fetch\s*\(|localStorage|sessionStorage|document\.cookie|innerHTML/);
});
