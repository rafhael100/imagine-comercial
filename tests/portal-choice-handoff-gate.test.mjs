import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPrivatePortalChoice,reviewedCiOnlyChoiceHandoff,reviewedCiOnlyOnepageSelectorHref} from
 '../ops/review/purchase/portal-choice-handoff-gate.mjs';
import {REVIEWED_OFFERS,checkPrivatePortalUrl} from
 '../ops/review/purchase/private-portal-handoff-policy.mjs';

const ci=Object.freeze({GITHUB_ACTIONS:'true',IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW:'1'});
test('F327 only four single-offer handoffs can prepare private Portal context',()=>{
 const expected=[
  [{site:'onepage',channels:[],tier:'minimum'},'onepage'],
  [{site:'landing-pages',channels:[],tier:'recommended'},'landing-pages'],
  [{site:'none',channels:['google_ads'],tier:'minimum'},'gestao-google-ads'],
  [{site:'none',channels:['meta_ads'],tier:'recommended'},'gestao-meta-ads']
 ];
 for(const [selection,slug] of expected){
  const publicGate=reviewedCiOnlyChoiceHandoff(selection,{});
  assert.equal(publicGate.href,null);
  assert.equal(publicGate.canNavigate,false);
  const testGate=reviewedCiOnlyChoiceHandoff(selection,ci);
  assert.equal(testGate.code,'single_product_preview');
  assert.equal(testGate.slug,slug);
  assert.ok(Object.hasOwn(REVIEWED_OFFERS,slug));
  assert.equal(testGate.canNavigate,true);
  assert.equal(checkPrivatePortalUrl(testGate.href,slug),true);
  const url=new URL(testGate.href);
  assert.equal(url.host,'portal-dev.imaginecomunica.com.br');
  assert.deepEqual([...url.searchParams.keys()].sort(),
    slug.startsWith('gestao-')?['channel','product']:['product']);
  for(const forbidden of ['amount','price','budget','customer','email','tenant','redirect','token','tier']){
   assert.equal(url.searchParams.has(forbidden),false);
  }
 }
});
test('F327 all 24 selectors classified: eight single-product, sixteen held; no silent cart loss',()=>{
 const sites=['none','onepage','landing-pages'];
 const combos=[[],['google_ads'],['meta_ads'],['google_ads','meta_ads']];
 let eligible=0,held=0,empty=0;
 for(const site of sites)for(const channels of combos)for(const tier of ['minimum','recommended']){
  const selection={site,channels,tier};
  const d=assessPrivatePortalChoice(selection);
  const ciResult=reviewedCiOnlyChoiceHandoff(selection,ci);
  if(site==='none'&&channels.length===0){
   assert.equal(d.code,'no_selection');assert.equal(ciResult.href,null);empty++;
  }else if(site!=='none'&&channels.length>0){
   assert.equal(d.code,'multi_product_cart_required');
   assert.equal(ciResult.href,null);held++;
  }else if(channels.length===2){
   assert.equal(d.code,'multi_channel_cart_required');
   assert.equal(ciResult.href,null);held++;
  }else{
   assert.equal(d.code,'single_product_preview');
   assert.equal(ciResult.canNavigate,true);
   eligible++;
  }
 }
 assert.equal(eligible,8);assert.equal(held,14);assert.equal(empty,2);
});
test('F327 CI opt-in is fail-closed and never publishes a checkout link',()=>{
 const selection={site:'none',channels:['google_ads'],tier:'minimum'};
 for(const env of [undefined,null,{}, {GITHUB_ACTIONS:'true'},{
  GITHUB_ACTIONS:'false',IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW:'1'
 },{GITHUB_ACTIONS:'true',IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW:'0'}]){
  // Default undefined triggers process.env; the test is intentionally NOT an opted-in process.
  const d=reviewedCiOnlyChoiceHandoff(selection,env);
  assert.equal(d.canNavigate,false);
  assert.equal(d.href,null);
 }
});
test('F327 unsupported choices and impersonation fields cannot become Portal destinations',()=>{
 for(const input of [
  {site:'none',channels:['chatgpt_ads'],tier:'recommended'},
  {site:'onepage',channels:['google_ads','meta_ads','chatgpt_ads'],tier:'minimum'},
  {site:'criacao-de-sites',channels:[],tier:'minimum'},
  {site:'none',channels:['google_ads','google_ads'],tier:'minimum'},
  {site:'onepage',channels:[],tier:'unknown'}
 ]){
  assert.throws(()=>assessPrivatePortalChoice(input));
  assert.throws(()=>reviewedCiOnlyChoiceHandoff(input,ci));
 }
});

test('Onepage selector emits no destination unless both private capabilities are explicitly opted in',()=>{
 const keys=['GITHUB_ACTIONS','IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW','IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW'];
 const values=['true','1','1'];
 for(let mask=0;mask<8;mask++){
  const env=Object.fromEntries(keys.flatMap((key,i)=>mask&(1<<i)?[[key,values[i]]]:[]));
  const href=reviewedCiOnlyOnepageSelectorHref(env);
  if(mask!==7)assert.equal(href,null,'A missing opt-in cannot leak a private destination');
  else {
   assert.equal(checkPrivatePortalUrl(href,'onepage'),true);
   assert.deepEqual([...new URL(href).searchParams],[['product','onepage']]);
  }
 }
 for(const key of keys)for(const value of ['',true,1,'TRUE','true ','1 ','0']){
  assert.equal(reviewedCiOnlyOnepageSelectorHref({
   GITHUB_ACTIONS:'true',IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW:'1',
   IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW:'1',[key]:value
  }),null);
 }
 assert.equal(reviewedCiOnlyOnepageSelectorHref(null),null);
});
