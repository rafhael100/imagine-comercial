/**
 * F175 — URL fragment that contains exactly TWO reviewed service slugs.
 * It never represents a quote, purchase, recommendation or customer record.
 */
import {comparisonOptions} from './service-comparison.mjs';

const slugs=Object.freeze(comparisonOptions.map(item=>item.slug));
const order=new Map(slugs.map((slug,index)=>[slug,index]));
const prefix='#comparar:';

// F343: a sparse pair can skip Array.some() validation and its indices may
// be accessor getters or carry private metadata. Validate own descriptors
// before reading or sorting any value into a customer-shareable URL.
const reviewedPair=pair=>{
  if(!Array.isArray(pair)||Object.getPrototypeOf(pair)!==Array.prototype||
     pair.length!==2||Reflect.ownKeys(pair).length!==3)return false;
  const first=Object.getOwnPropertyDescriptor(pair,'0');
  const second=Object.getOwnPropertyDescriptor(pair,'1');
  return first?.enumerable===true&&Object.hasOwn(first,'value')&&
    second?.enumerable===true&&Object.hasOwn(second,'value')&&
    typeof first.value==='string'&&typeof second.value==='string'&&
    order.has(first.value)&&order.has(second.value)&&first.value!==second.value;
};
export function encodeReviewedComparisonFragment(pair){
  if(!reviewedPair(pair))
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
