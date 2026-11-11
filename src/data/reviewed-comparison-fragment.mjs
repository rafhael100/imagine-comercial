/**
 * F175 — URL fragment that contains exactly TWO reviewed service slugs.
 * It never represents a quote, purchase, recommendation or customer record.
 */
import {comparisonOptions} from './service-comparison.mjs';

const slugs=Object.freeze(comparisonOptions.map(item=>item.slug));
const order=new Map(slugs.map((slug,index)=>[slug,index]));
const prefix='#comparar:';

export function encodeReviewedComparisonFragment(pair){
  if(!Array.isArray(pair)||pair.length!==2||
     pair.some(value=>typeof value!=='string'||!order.has(value))||
     pair[0]===pair[1])
    throw Error('F175: exactly two different approved services required');
  const sorted=[...pair].sort((a,b)=>order.get(a)-order.get(b));
  return prefix+sorted.join(':');
}
export function decodeReviewedComparisonFragment(hash){
  if(typeof hash!=='string'||hash.length>90||!hash.startsWith(prefix))
    return null;
  const pair=hash.slice(prefix.length).split(':');
  if(pair.length!==2)return null;
  try{
    const canonical=encodeReviewedComparisonFragment(pair);
    if(canonical!==hash)return null;
    return Object.freeze(pair);
  }catch{
    return null;
  }
}
