/**
 * F315 — finite, curated WhatsApp messages for the three advertising channels.
 * No free text, lead PII, spending numbers, session state or network activity.
 * Messages are derived only from a reviewed 7-combination x 3-locale catalog.
 */
const IDS=Object.freeze(['chatgpt_ads','google_ads','meta_ads']);
const LABELS=Object.freeze({
 chatgpt_ads:'ChatGPT Ads',
 google_ads:'Google Ads',
 meta_ads:'Meta Ads'
});
const LOCALES=Object.freeze(['pt','en','es']);
const messages=Object.freeze({
 pt: names=>'Olá! Usei a calculadora da Imagine e gostaria de um planejamento para anúncios em '+names+'. Quero falar com a equipe.',
 en: names=>'Hello! I used Imagine’s ad budget calculator and would like to discuss advertising on '+names+'. Please contact me.',
 es: names=>'¡Hola! Usé la calculadora publicitaria de Imagine y quisiera hablar sobre anuncios en '+names+'. Deseo recibir orientación.'
});
export const CALCULATOR_CONTACT_OPTIONS=Object.freeze(Object.fromEntries(
 LOCALES.map(locale=>[locale,Object.freeze(
  Array.from({length:7},(_,index)=>{
   const selected=IDS.filter((_,i)=>(index+1)&(1<<i));
   const key=selected.join('+');
   const names=selected.map(id=>LABELS[id]).join(', ');
   const message=messages[locale](names);
   if(message.length>280||message.length<40)
    throw Error('F315: reviewed contact message outside allowed bounds');
   return Object.freeze({key,channels:Object.freeze(selected),
     locale,message});
  })
 )])
));
export function calculatorContactKey(channels){
 if(!Array.isArray(channels)||Object.getPrototypeOf(channels)!==Array.prototype||
    channels.length<1||channels.length>3||
    Reflect.ownKeys(channels).length!==channels.length+1)
   throw Error('F315: invalid calculator channel selection');
 const selected=[...channels];
 if(selected.some(id=>typeof id!=='string'||!IDS.includes(id))||
    new Set(selected).size!==selected.length)
   throw Error('F315: unapproved calculator channel');
 return selected.sort().join('+');
}
export function reviewedCalculatorContact(locale,channels){
 if(!LOCALES.includes(locale))
  throw Error('F315: unapproved language');
 const key=calculatorContactKey(channels);
 const found=CALCULATOR_CONTACT_OPTIONS[locale].find(x=>x.key===key);
 if(!found)throw Error('F315: no curated message for combination');
 return found;
}
