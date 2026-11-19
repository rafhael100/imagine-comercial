import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialChoicePreview} from '../src/lib/commercial-choice-preview.mjs';
import {describeSelectedAdvertisingCosts as breakdown} from '../src/lib/public-quote-channel-breakdown.mjs';

test('F355: per-channel presentation reconciles with whole estimate in 144 selections',()=>{
 let checked=0;
 for(const locale of ['pt-BR','en','es'])
  for(const site of ['none','onepage','landing-pages'])
   for(const tier of ['minimum','recommended'])
    for(let mask=0;mask<8;mask++){
     const channels=['google_ads','meta_ads','chatgpt_ads'].filter((_,i)=>mask&(1<<i));
     const selection={site,channels,tier};
     const quote=buildCommercialChoicePreview(selection);
     const lines=breakdown(selection,locale);
     assert.ok(Object.isFrozen(lines));
     assert.deepEqual(lines.map(line=>line.code),channels);
     assert.equal(lines.reduce((sum,line)=>sum+line.mediaCents,0),quote.adMediaCents);
     assert.equal(lines.reduce((sum,line)=>sum+line.activationCents,0),quote.adActivationCents);
     assert.equal(lines.reduce((sum,line)=>sum+line.estimatedManagementCents,0),quote.adManagementEstimateCents);
     for(const line of lines){
      assert.ok(Object.isFrozen(line));
      assert.match(line.label,/^(Google|Meta|ChatGPT) Ads$/);
      assert.ok(Number.isSafeInteger(line.mediaCents)&&line.mediaCents>=0);
      assert.ok(Number.isSafeInteger(line.activationCents)&&line.activationCents>=0);
      assert.ok(Number.isSafeInteger(line.estimatedManagementCents)&&line.estimatedManagementCents>=0);
      assert.deepEqual(Object.keys(line).sort(),['activationCents','code','estimatedManagementCents','label','mediaCents']);
     }
     checked++;
    }
 assert.equal(checked,144);
});
test('F355: rejects hidden data, getters, duplicate channels and unknown locale',()=>{
 assert.throws(()=>breakdown({site:'onepage',channels:[],tier:'minimum',customer:'x'}),/Invalid quote selection/);
 assert.throws(()=>breakdown({site:'none',channels:['meta_ads','meta_ads'],tier:'recommended'}),/duplicate/);
 assert.throws(()=>breakdown({site:'none',channels:[],tier:'minimum'},'fr'),/Unsupported advertising cost locale/);
 let accessed=false;
 const selection={site:'onepage',channels:[],tier:'minimum'};
 Object.defineProperty(selection,'tenantId',{get(){accessed=true;return 'x';}});
 assert.throws(()=>breakdown(selection),/Invalid quote selection/);
 assert.equal(accessed,false);
});
test('F355: visible per-channel data uses safe DOM updates and no network',()=>{
 const component=readFileSync(new URL('../src/components/CommercialChoicePreview.astro',import.meta.url),'utf8');
 assert.match(component,/data-choice-channel-costs/);
 assert.match(component,/data-choice-channel-breakdown/);
 assert.match(component,/describeSelectedAdvertisingCosts\(\{site,channels,tier\},locale\)/);
 assert.match(component,/li\.textContent=/);
 assert.match(component,/costsList\.replaceChildren\(fragment\)/);
 assert.doesNotMatch(component,/costsList\.innerHTML|costsList\.insertAdjacentHTML/);
});
