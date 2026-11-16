import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeCuratedBriefingFragment,decodeCuratedBriefingFragment} from '../src/data/curated-briefing-fragment.mjs';
import {
 buildGrowthPotential,GROWTH_SCENARIOS,GROWTH_SECTORS,
 MAX_WEEKLY_VISITS,GROWTH_WEEKS_PER_MONTH
} from '../src/lib/growth-potential-calculator.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('F331: 100 weekly visits => 400 per four-week planning month',()=>{
 const estimate=buildGrowthPotential({weeklyVisits:100,sector:'services',scenario:'reference'});
 assert.equal(estimate.weeklyVisits,100);
 assert.equal(estimate.monthlyVisits,400);
 assert.equal(estimate.leads,16);
 assert.equal(estimate.customers,3);
 assert.deepEqual(estimate.leadsRange,[8,24]);
 assert.deepEqual(estimate.customersRange,[1,7]);
 assert.deepEqual(estimate.scenarios.conservative,{leadRatePercent:2,closeRatePercent:10,leads:8,customers:1});
 assert.deepEqual(estimate.scenarios.reference,{leadRatePercent:4,closeRatePercent:20,leads:16,customers:3});
 assert.deepEqual(estimate.scenarios.optimistic,{leadRatePercent:6,closeRatePercent:30,leads:24,customers:7});
 assert.equal(GROWTH_WEEKS_PER_MONTH,4);
 assert.equal(estimate.assumptionOnly,true);
 assert.equal(estimate.actualPerformanceData,false);
 assert.equal(estimate.customerDataStored,false);
 assert.equal(estimate.realResultsGuaranteed,false);
 assert.ok(Object.isFrozen(estimate));
 assert.ok(Object.isFrozen(estimate.scenarios));
 assert.ok(Object.isFrozen(estimate.leadsRange));
});

test('F331: all segments use the SAME illustrative math, not invented industry benchmarks',()=>{
 for(const sector of GROWTH_SECTORS){
  for(const scenario of Object.keys(GROWTH_SCENARIOS)){
   const expected=buildGrowthPotential({weeklyVisits:250,sector:'services',scenario});
   const actual=buildGrowthPotential({weeklyVisits:250,sector,scenario});
   assert.equal(actual.leads,expected.leads);
   assert.equal(actual.customers,expected.customers);
   assert.deepEqual(actual.leadsRange,expected.leadsRange);
   assert.deepEqual(actual.customersRange,expected.customersRange);
  }
 }
});

test('F331: valid zero, smaller and large volumes remain finite and monotone',()=>{
 for(const scenario of Object.keys(GROWTH_SCENARIOS)){
  const zero=buildGrowthPotential({weeklyVisits:0,scenario});
  assert.equal(zero.leads,0);
  assert.equal(zero.customers,0);
  let lastLeads=0,lastClients=0;
  for(const weeklyVisits of [1,10,100,1000,20000,MAX_WEEKLY_VISITS]){
    const value=buildGrowthPotential({weeklyVisits,scenario});
    assert.ok(Number.isSafeInteger(value.monthlyVisits));
    assert.ok(value.leads>=lastLeads);
    assert.ok(value.customers>=lastClients);
    assert.ok(value.customers<=value.leads);
    lastLeads=value.leads;lastClients=value.customers;
  }
 }
});

test('F331: strictly reject malformed or unexpected numeric and sector inputs',()=>{
 for(const weeklyVisits of [-1,100001,2.5,NaN,Infinity,'100',null,undefined,{},[],Number.MAX_SAFE_INTEGER])
  assert.throws(()=>buildGrowthPotential({weeklyVisits}));
 for(const sector of ['finance','__proto__','','SERVICES',null,{},['services']])
  assert.throws(()=>buildGrowthPotential({weeklyVisits:100,sector}));
 for(const scenario of ['growth','constructor','__proto__','',null,{}])
  assert.throws(()=>buildGrowthPotential({weeklyVisits:100,scenario}));
});

test('F331: only one funnel on each localized home, preserves approved GrowthPillars and choice simulator',()=>{
 const pt=read('src/pages/index.astro');
 const intl=read('src/components/InternationalSalesHome.astro');
 assert.ok(pt.indexOf('<GrowthPillars variant="feature"')<pt.indexOf('<GrowthFunnelCalculator locale="pt-BR" />'));
 assert.ok(pt.indexOf('<GrowthFunnelCalculator')<pt.indexOf('<QuickServiceRequest />'));
 assert.equal((pt.match(/<GrowthFunnelCalculator/g)||[]).length,1);
 assert.ok(intl.indexOf('<GrowthPillars variant="feature"')<intl.indexOf('<GrowthFunnelCalculator locale={locale} />'));
 assert.equal((intl.match(/<GrowthFunnelCalculator/g)||[]).length,1);
 assert.match(intl,/<CommercialChoicePreview locale=\{locale\}\/>/);
});

test('F331: calculator HTML and JS remain anonymous, accessible and non-submitting',()=>{
 const s=read('src/components/GrowthFunnelCalculator.astro');
 for(const text of [
  'data-growth-calculator','data-growth-form','data-growth-results',
  'data-growth-weekly','data-growth-sector','data-growth-scenario',
  'data-growth-copy','data-growth-copied','data-funnel-visits',
  'data-funnel-leads','data-funnel-customers',
  'aria-live="polite"','aria-atomic="true"','aria-labelledby',
  "data-growth-calculate","navigator.clipboard.writeText",
  "event.preventDefault()"
 ])assert.ok(s.includes(text),text);
 assert.match(s,/role="alert"/);
 assert.match(s,/inputmode="numeric"/);
 assert.match(s,/max="100000"/);
 assert.doesNotMatch(s,/<form\b/);
 assert.match(s,/id=\{\x27growth-weekly-\x27\+locale\}/);
 assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|innerHTML|\bPOST\b/);
 assert.doesNotMatch(s,/type="email"|name="email"|name="telefone"|name="cpf"/);
 for(const marker of [
  'Exercício matemático, não previsão',
  'Arithmetic illustration, not a forecast',
  'Ejercicio matemático, no pronóstico',
  '4 semanas por mês',
  '4 weeks per month',
  '4 semanas por mes',
  'não são médias de mercado'
 ])assert.ok(s.includes(marker),marker);
});

test('F332: editing any funnel assumption invalidates visible and copyable results',()=>{
 const s=read('src/components/GrowthFunnelCalculator.astro');
 assert.match(s,/const invalidateEstimate=\(\)=>\{/);
 assert.match(s,/input\.addEventListener\('input',invalidateEstimate\)/);
 assert.match(s,/sector\.addEventListener\('change',invalidateEstimate\)/);
 assert.match(s,/radio\.addEventListener\('change',invalidateEstimate\)/);
 assert.match(s,/last=null;\s*output\.hidden=true;\s*copyStatus\.hidden=true;/);
 assert.match(s,/node\.hidden=true;node\.textContent='';/);
 assert.match(s,/if\(!last\)return;/);
});

test('F333: optional copied summary names the selected illustrative scenario in each locale',()=>{
 const s=read('src/components/GrowthFunnelCalculator.astro');
 assert.match(s,/const scenarioLabel=form\.querySelector\('\[data-growth-scenario\]:checked'\)/);
 assert.match(s,/t\.scenario\+': '\+scenarioLabel/);
 for(const label of ["scenario:'Cenário'","scenario:'Scenario'","scenario:'Escenario'"])
  assert.ok(s.includes(label),label);
 assert.match(s,/if\(!last\)return;/);
 assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});

test('F333: asynchronous clipboard completion cannot restore stale status after recalculation',()=>{
 const s=read('src/components/GrowthFunnelCalculator.astro');
 assert.match(s,/let estimateRevision=0;/);
 assert.match(s,/const invalidateEstimate=\(\)=>\{\s*estimateRevision\+\+;/);
 assert.match(s,/estimateRevision\+\+;\s*last=estimate;/);
 assert.match(s,/const revision=estimateRevision;/);
 assert.match(s,/await navigator\.clipboard\.writeText\(message\);\s*if\(revision!==estimateRevision\)return;/);
 assert.match(s,/if\(revision===estimateRevision\)copyStatus\.hidden=false;/);
});

test('F334: funnel-to-contact link carries only reviewed public briefing priority',()=>{
 const target=encodeCuratedBriefingFragment('','','','contatos');
 assert.equal(target,'#briefing:_:_:_:contatos');
 assert.deepEqual(decodeCuratedBriefingFragment(target),{
  service:'',objective:'',stage:'',priority:'contatos'
 });
 const s=read('src/components/GrowthFunnelCalculator.astro');
 assert.match(s,/encodeCuratedBriefingFragment\('','','','contatos'\)/);
 assert.match(s,/: intlPath\(locale,'contact'\)/);
 assert.doesNotMatch(s,/URLSearchParams|document\.cookie|localStorage|sessionStorage|\bfetch\s*\(/);
});

test('F335: copied and displayed funnel results disclose actual illustrative percentages and planning period',()=>{
 const s=read('src/components/GrowthFunnelCalculator.astro');
 assert.match(s,/data-growth-assumptions-template=\{t\.assumptions\}/);
 assert.match(s,/data-growth-assumptions>\{initialAssumptions\}/);
 assert.match(s,/rate=value\.scenarios\[value\.scenario\]/);
 assert.match(s,/label\('\[data-growth-assumptions\]',assumptionsText\(estimate\)\)/);
 assert.match(s,/assumptionsText\(last\),\s*t\.warning/);
 for(const text of [
  'não são médias de mercado: {lead}%',
  'not industry averages: {lead}%',
  'no promedios del mercado: {lead}%',
  '{close}%','4 semanas','4-week planning month'
 ])assert.ok(s.includes(text),text);
 const hypothetical=buildGrowthPotential({weeklyVisits:100,scenario:'optimistic'});
 assert.deepEqual({
  lead:hypothetical.scenarios.optimistic.leadRatePercent,
  close:hypothetical.scenarios.optimistic.closeRatePercent
 },{lead:6,close:30});
 assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});
