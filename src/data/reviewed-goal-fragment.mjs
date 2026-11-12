/**
 * F196: five immutable public business objectives carried only as URL hashes.
 * No visitor-specific data, query parameters, eligibility or persistence.
 */
import {guideGoals} from '../lib/public-service-guide.mjs';
const known=new Set(guideGoals.map(x=>x.code));
if(known.size!==5)throw Error('F196: unexpected public objective catalog');
export function encodeReviewedGoalFragment(code){
  if(typeof code!=='string'||!known.has(code))
    throw Error('F196: unreviewed public goal');
  return '#objetivo:'+code;
}
export function decodeReviewedGoalFragment(hash){
  if(typeof hash!=='string'||hash.length>60||!hash.startsWith('#objetivo:'))
    return null;
  const code=hash.slice('#objetivo:'.length);
  return known.has(code)&&encodeReviewedGoalFragment(code)===hash?code:null;
}
