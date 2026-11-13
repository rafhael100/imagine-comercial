/**
 * F188: a fixed, reviewed pair of PUBLIC services for voluntary contact.
 * No profile, free-text input, price, receipt, authorization or persistence.
 */
import {comparisonOptions} from './service-comparison.mjs';
import {encodeReviewedComparisonFragment} from './reviewed-comparison-fragment.mjs';
const bySlug=new Map(comparisonOptions.map(item=>[item.slug,item]));
export function composeReviewedComparisonContact(pair){
  const fragment=encodeReviewedComparisonFragment(pair);
  const [first,second]=fragment.slice('#comparar:'.length).split(':');
  const a=bySlug.get(first),b=bySlug.get(second);
  if(!a||!b)throw Error('F188: unreviewed comparison');
  const subject='Comparação Imagine - '+a.label+' e '+b.label;
  const message='Olá, gostaria de conversar sobre '+a.label+' e '+b.label+
    ' da Imagine para avaliar qual solução faz sentido.';
  if(subject.length>120||message.length>280)
    throw Error('F188: public comparison text exceeds contact limits');
  return Object.freeze({fragment,subject,message});
}
