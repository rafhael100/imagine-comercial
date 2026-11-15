/**
 * F325: validate on-disk compiled Astro output from BOTH modes.
 * No network, no parsing live customer data, no deployment.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {reviewedPrivateQuoteHandoffUrl,REVIEWED_PRIVATE_QUOTE_BASE} from './private-quote-handoff-f325.mjs';
const [dir,mode]=process.argv.slice(2);
assert.ok(dir && ['public','private'].includes(mode),'Explicit compiled dir and mode required');
const base=resolve(dir);
const selected={site:'onepage',channels:[],tier:'recommended'};
for(const [lang,path] of [['pt-BR','index.html'],['en','en/index.html'],['es','es/index.html']]){
 const html=readFileSync(join(base,path),'utf8');
 const section=html.match(/<section\b[^>]*data-choice-preview[^>]*>/)?.[0];
 const action=html.match(/<a\b[^>]*data-choice-action[^>]*>/)?.[0];
 assert.ok(section && action,'Missing reviewed estimate markup: '+lang);
 const get=(tag,name)=>tag.match(new RegExp('\\b'+name+'="([^"]*)"'))?.[1]?.replaceAll('&amp;','&')??null;
 assert.equal(get(section,'data-locale'),lang);
 if(mode==='public'){
  assert.equal(get(section,'data-private-handoff-base'),null,'Private origin must not leak to public HTML');
  assert.ok(get(action,'href')?.startsWith('https://wa.me/'),'Public quote must remain WhatsApp');
  assert.equal(get(action,'target'),'_blank');
  assert.equal(get(action,'rel'),'noopener noreferrer');
  assert.ok(!html.includes(REVIEWED_PRIVATE_QUOTE_BASE),'Public HTML cannot include private staging URL');
 }else{
  assert.equal(get(section,'data-private-handoff-base'),REVIEWED_PRIVATE_QUOTE_BASE);
  assert.equal(get(action,'href'),reviewedPrivateQuoteHandoffUrl(selected));
  assert.equal(get(action,'target'),null,'Private Portal continuation opens in same tab');
  assert.equal(get(action,'rel'),'nofollow noreferrer');
  assert.equal(get(action,'referrerpolicy'),'no-referrer');
  const u=new URL(get(action,'href'));
  assert.deepEqual([...u.searchParams.keys()],['site','channels','tier']);
 }
}
if(mode==='public'){
 // Private Portal base must not be present in any public JS asset either.
 // Hand-off origin is injected into HTML only in a private build.
 const {readdirSync,statSync}=await import('node:fs');
 const assets=join(base,'_astro');
 for(const file of readdirSync(assets)){
  const path=join(assets,file);
  if(statSync(path).isFile() && file.endsWith('.js')){
   const js=readFileSync(path,'utf8');
   assert.ok(!js.includes(REVIEWED_PRIVATE_QUOTE_BASE),'Staging URL leaked into public JS');
  }
 }
}
console.log('PASS F325 '+mode+' PT EN ES preview: no real checkout and exact private/public URLs');
