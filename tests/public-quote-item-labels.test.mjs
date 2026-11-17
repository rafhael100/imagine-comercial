import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeSelectedQuoteServices as describe} from '../src/lib/public-quote-item-labels.mjs';
const choice=(site,channels=[],tier='recommended')=>({site,channels,tier});
test('F354 quote labels remain exact for all 48 selections and three locales',()=>{
 let count=0;
 for(const site of ['none','onepage','landing-pages'])
  for(const tier of ['minimum','recommended'])
   for(let mask=0;mask<8;mask++){
    const channels=['google_ads','meta_ads','chatgpt_ads'].filter((_,i)=>mask&(1<<i));
    for(const locale of ['pt-BR','en','es']){
     const items=describe(choice(site,channels,tier),locale);
     assert.deepEqual(items.map(item=>item.code),[...(site==='none'?[]:[site]),...channels]);
     assert.ok(Object.isFrozen(items));
     for(const item of items){
      assert.ok(Object.isFrozen(item));
      assert.match(item.label,/Onepage|Landing Page|Google Ads|Meta Ads|ChatGPT Ads/);
      assert.doesNotMatch(JSON.stringify(item),/price|token|password|customer|tenant|https?:/i);
     }
     count++;
    }
   }
 assert.equal(count,144);
 assert.deepEqual(describe(choice('none')),[]);
});
test('F354 refuses unreviewed data without evaluating hidden getters',()=>{
 assert.throws(()=>describe({...choice('onepage'),customerId:'secret'}),/Invalid quote selection/);
 assert.throws(()=>describe(choice('onepage',[],'premium')),/Unreviewed/);
 assert.throws(()=>describe(choice('onepage'),'fr'),/Unsupported quote summary locale/);
 let touched=false;
 const obj=choice('onepage');
 Object.defineProperty(obj,'customerId',{get(){touched=true;return 'secret';}});
 assert.throws(()=>describe(obj),/Invalid quote selection/);
 assert.equal(touched,false);
});
test('F354 renders the first selection in HTML and updates with safe text nodes',()=>{
 const source=readFileSync(new URL('../src/components/CommercialChoicePreview.astro',import.meta.url),'utf8');
 assert.match(source,/data-choice-selected-items/);
 assert.match(source,/initialServices\.map\(item=><li>\{item\.label\}<\/li>\)/);
 assert.match(source,/describeSelectedQuoteServices\(\{site,channels,tier\},locale\)/);
 assert.match(source,/li\.textContent=item\.label/);
 assert.match(source,/selectedItems\.replaceChildren\(fragment\)/);
 assert.doesNotMatch(source,/selectedItems\.innerHTML|selectedItems\.insertAdjacentHTML/);
});
