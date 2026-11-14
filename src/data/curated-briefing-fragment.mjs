/**
 * F169 — share a REVIEWED, public-only contact briefing in a URL fragment.
 * No free text, customer profile, cookies, query params, network or storage.
 * Legacy #service deep links are handled by the calling contact page.
 */
import {services} from './services.mjs';
import {contactObjectives} from './contact-objectives.mjs';
import {briefingStages,briefingPriorities} from './briefing-curado.mjs';

const allowed=Object.freeze([
  new Set(['',...services.map(x=>x.slug)]),
  new Set(['',...contactObjectives.map(x=>x.code)]),
  new Set(['',...briefingStages.map(x=>x.code)]),
  new Set(['',...briefingPriorities.map(x=>x.code)])
]);
const prefix='#briefing:';
const token=value=>value===''?'~':value;

export function encodeCuratedBriefingFragment(
  service='',objective='',stage='',priority=''
){
  const values=[service,objective,stage,priority];
  if(values.some((item,i)=>typeof item!=='string'||!allowed[i].has(item)))
    throw Error('F169: unsupported reviewed public briefing state');
  return prefix+values.map(token).join(':');
}
export function decodeCuratedBriefingFragment(fragment){
  if(typeof fragment!=='string'||fragment.length>145||
     !fragment.startsWith(prefix))return null;
  const parts=fragment.slice(prefix.length).split(':');
  if(parts.length!==4)return null;
  const values=parts.map(part=>part==='~'?'':part);
  if(values.some((item,i)=>!allowed[i].has(item)))return null;
  // Reject alternate forms and ambiguous encodings, including URL escapes.
  if(encodeCuratedBriefingFragment(...values)!==fragment)return null;
  return Object.freeze({
    service:values[0],objective:values[1],
    stage:values[2],priority:values[3]
  });
}
