import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatReviewedCommercialEstimate as format}
 from '../src/lib/commercial-estimate-copy.mjs';
import {buildCommercialChoicePreview,describeThreeIllustrativeInstallments}
 from '../src/lib/commercial-choice-preview.mjs';

const choice=(overrides={})=>({
 site:'onepage',channels:['google_ads','meta_ads'],tier:'recommended',...overrides
});

test('F346 voluntary PT quote copy always reflects exact reviewed cent amounts and 90-day billing',()=>{
 const text=format(choice(),'pt-BR');
 const q=buildCommercialChoicePreview(choice());
 assert.equal(q.contractedSetupAndActivationCents,197000);
 assert.ok(text.startsWith('Simulação Imagine — não é proposta nem contratação'));
 assert.match(text,/Serviços escolhidos: Site Onepage \+ Google Ads \+ Meta Ads/);
 assert.match(text,/Implantação do site: R\$ 990,00/);
 assert.match(text,/Ativação dos anúncios \(uma vez\): R\$ 980,00/);
 assert.match(text,/2 × R\$ 656,66 \+ 1 × R\$ 656,68 \(total ilustrativo: R\$ 1\.970,00\)/);
 assert.match(text,/Mensalidade do site: R\$ 79,90 \(início a partir de 90 dias da contratação\)/);
 assert.match(text,/Gestão de anúncios estimada por mês: R\$ 500,00/);
 assert.match(text,/Mídia planejada por mês: R\$ 2\.500,00 \(paga diretamente às plataformas\)/);
 assert.match(text,/Termos finais dependem de confirmação no Portal/);
 assert.equal(text.split('\n').length,10);
 assert.doesNotMatch(text,/https?:\/\/|@|token|CPF|CNPJ|checkoutUrl/);
});

test('F346 site-only, ads-only and international summaries keep cost lines independent',()=>{
 const website=format(choice({channels:[],tier:'minimum'}),'pt-BR');
 assert.match(website,/3 × R\$ 330,00 \(total ilustrativo: R\$ 990,00\)/);
 assert.match(website,/Ativação dos anúncios \(uma vez\): R\$ 0,00/);
 const channelsOnly=format(choice({site:'none',channels:['meta_ads'],tier:'minimum'}),'pt-BR');
 assert.match(channelsOnly,/Serviços escolhidos: Sem site \+ Meta Ads/);
 assert.match(channelsOnly,/2 × R\$ 163,33 \+ 1 × R\$ 163,34 \(total ilustrativo: R\$ 490,00\)/);
 assert.match(channelsOnly,/Mensalidade do site: R\$ 0,00/);
 for(const [locale,start,marker] of [
  ['en','Imagine estimate','2 × BRL 656.66 + 1 × BRL 656.68'],
  ['es','Estimación Imagine','2 × R$ 656,66 + 1 × R$ 656,68']
 ]){
  const text=format(choice(),locale);
  assert.ok(text.startsWith(start));
  assert.ok(text.includes(marker));
  assert.equal(text.split('\n').length,10);
  assert.doesNotMatch(text,/https?:\/\/|PRIVATE|token|customerId/);
 }
});

test('F346 all public combinations copy the SAME total and split as the original public quote',()=>{
 let checked=0;
 for(const locale of ['pt-BR','en','es'])
  for(const site of ['none','onepage','landing-pages'])
   for(const tier of ['minimum','recommended'])
    for(let mask=0;mask<8;mask++){
     const channels=['google_ads','meta_ads','chatgpt_ads'].filter((_,i)=>mask&(1<<i));
     const selection={site,channels,tier};
     const estimate=buildCommercialChoicePreview(selection);
     if(!estimate.hasChoice){
      assert.throws(()=>format(selection,locale),/No anonymous selection/);
      continue;
     }
     const text=format(selection,locale);
     assert.ok(text.includes(describeThreeIllustrativeInstallments(
      estimate.contractedSetupAndActivationCents,locale)));
     assert.ok(text.length<2000);
     assert.equal(text.split('\n').length,10);
     checked++;
    }
 assert.equal(checked,138);
});

test('F346 rejects forged private properties, unreviewed locale, bad channels and no selection',()=>{
 for(const selection of [
  {site:'none',channels:[],tier:'minimum'},
  {...choice(),tenantId:'PRIVATE'},
  {...choice(),channels:['unknown_ads']},
  {...choice(),channels:['google_ads','google_ads']},
  {...choice(),tier:'vip'}
 ])assert.throws(()=>format(selection,'pt-BR'));
 assert.throws(()=>format(choice(),'fr'),/Unreviewed commercial estimate locale/);
 const src=readFileSync(new URL('../src/lib/commercial-estimate-copy.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/navigator|XMLHttpRequest|fetch\s*\(|sendBeacon|localStorage|sessionStorage|document\.cookie/);
 const component=readFileSync(new URL('../src/components/CommercialChoicePreview.astro',import.meta.url),'utf8');
 assert.match(component,/data-choice-copy>\{copy\.copyAction\}<\/button>/);
 assert.match(component,/data-choice-copy-status role="status" hidden/);
 assert.match(component,/await navigator\.clipboard\.writeText\(summary\)/);
 assert.match(component,/if\(choiceRevision!==version\)return/);
 assert.doesNotMatch(component,/<(?:form|input|textarea)\b|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});
