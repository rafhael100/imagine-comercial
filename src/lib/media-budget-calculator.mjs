/**
 * PERF-CALC P0 — public, deterministic media-budget suggestion.
 * BRL cents only. NO tracking, personal data, API, advertising or billing.
 * Channel floors and launch recommendations approved on 14/11/2026.
 * Historical CPL is SUPPLIED BY THE VISITOR; never invent market benchmarks.
 */
export const CHANNELS = Object.freeze({
  meta_ads: Object.freeze({label:'Meta Ads (Instagram e Facebook)', floorCents:70000, recommendedCents:100000}),
  google_ads: Object.freeze({label:'Google Ads',floorCents:100000,recommendedCents:150000}),
  chatgpt_ads: Object.freeze({label:'ChatGPT Ads',floorCents:120000,recommendedCents:180000})
});
const CHANNEL_IDS = Object.freeze(Object.keys(CHANNELS));
const MAX_CENTS = 100000000;
const MAX_LEADS = 100000;

function whole(value,min,max,label) {
  if(!Number.isSafeInteger(value)||value<min||value>max)
    throw new RangeError('Valor inválido: '+label);
  return value;
}
export function parseMoneyToCents(value) {
  if(typeof value!=='string'|| !/^(0|[1-9][0-9]{0,6})(?:[.,][0-9]{1,2})?$/.test(value.trim()))
    throw new RangeError('Informe moeda em reais, por exemplo 75,50.');
  const [wholePart,part='']=value.trim().replace(',','.').split('.');
  const cents=Number(wholePart)*100+Number(part.padEnd(2,'0'));
  return whole(cents,0,MAX_CENTS,'moeda');
}
export function formatBRL(cents) {
  whole(cents,0,300000000,'total');
  return (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
export function calculateMediaBudget({channels,objective='leads',targetLeads=0,historicalCplCents=0,monthlyLimitCents=0}) {
  if(!Array.isArray(channels)||channels.length<1||channels.length>3||
    channels.some(id=>!CHANNEL_IDS.includes(id))||
    new Set(channels).size!==channels.length)
    throw new RangeError('Escolha de um a três canais diferentes.');
  if(!['leads','sales','awareness'].includes(objective))
    throw new RangeError('Objetivo desconhecido.');
  whole(targetLeads,0,MAX_LEADS,'meta de leads');
  whole(historicalCplCents,0,MAX_CENTS,'CPL histórico');
  whole(monthlyLimitCents,0,MAX_CENTS,'limite de mídia');
  if((targetLeads===0)!==(historicalCplCents===0))
    throw new RangeError('Para usar a meta, informe quantidade de leads e CPL histórico juntos.');

  const sorted = [...channels].sort();
  const floorTotal=sorted.reduce((s,id)=>s+CHANNELS[id].floorCents,0);
  const baseline=sorted.reduce((s,id)=>s+CHANNELS[id].recommendedCents,0);
  // A meta × CPL declarado pelo visitante é apenas planejamento de cenário,
  // nunca promessa de aquisição nem benchmark da Imagine.
  const scenarioCents=targetLeads>0?whole(targetLeads*historicalCplCents,0,300000000,'cenário'):null;
  const chosen=Math.max(baseline,scenarioCents??0);
  if(chosen>300000000)throw new RangeError('Orçamento acima do limite da calculadora.');
  const lines=sorted.map(id=>{
    const c=CHANNELS[id];
    const calculated=Math.ceil(chosen*c.recommendedCents/baseline/1000)*1000; // nearest R$10 upwards
    const mediaCents=Math.max(c.recommendedCents,calculated);
    return Object.freeze({
      id,label:c.label,floorCents:c.floorCents,recommendedBaseCents:c.recommendedCents,
      suggestedCents:mediaCents
    });
  });
  const suggestedMediaCents=lines.reduce((s,x)=>s+x.suggestedCents,0);
  const illustrativeManagementCents=Math.floor((suggestedMediaCents*20+50)/100);
  return Object.freeze({
    version:'PERF-CALC-P0-2026-11-14',
    currency:'BRL',
    objective,
    channels:Object.freeze(lines),
    minimumMediaCents:floorTotal,
    recommendedBaselineCents:baseline,
    goalScenarioCents:scenarioCents,
    historicalCplSuppliedByVisitor:historicalCplCents>0,
    suggestedMediaCents,
    illustrativeManagementCents,
    illustrativeTotalCents:suggestedMediaCents+illustrativeManagementCents,
    monthlyLimitCents,
    exceedsMonthlyLimit:monthlyLimitCents>0&&suggestedMediaCents>monthlyLimitCents,
    mediaPaidDirectlyToPlatforms:true,
    doesNotGuaranteeLeadsOrSales:true,
    publicCheckoutEnabled:false,
    leadSentToCrm:false,
    methodology:scenarioCents!==null?
      'Maior valor entre a referência inicial Imagine e meta de leads multiplicada pelo CPL histórico informado, distribuído proporcionalmente. É um cenário, não previsão.' :
      'Referência de partida da Imagine por canal; sem dados próprios de CPL não é possível calcular quantidade de leads ou vendas.'
  });
}
