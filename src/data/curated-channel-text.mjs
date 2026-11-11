/**
 * F159 — single immutable-in-practice lookup of public, predefined text.
 * Both URL constructors and the compiled/DOM allowlists can rely on this
 * policy. No free text, personal data, input forms or network traffic.
 */
import {services} from './services.mjs';
import {contactObjectives} from './contact-objectives.mjs';
import {briefingStages,briefingPriorities,composeCuratedBriefingLinks} from './briefing-curado.mjs';

const messages=new Set();
const subjects=new Set();
const subjectBodyPairs=new Set();
let combinations=0;
for(const service of ['',...services.map(item=>item.slug)])
for(const objective of ['',...contactObjectives.map(item=>item.code)])
for(const stage of ['',...briefingStages.map(item=>item.code)])
for(const priority of ['',...briefingPriorities.map(item=>item.code)]){
  const {message,subject}=composeCuratedBriefingLinks(service,objective,stage,priority);
  messages.add(message);
  subjects.add(subject);
  subjectBodyPairs.add(subject+'\0'+message);
  combinations++;
}
if(combinations!==560||messages.size<35||subjects.size<7)
  throw Error('F159: invalid public curated contact catalog');

export const isCuratedPublicMessage=value=>
  typeof value==='string'&&messages.has(value);
export const isCuratedPublicSubject=value=>
  typeof value==='string'&&subjects.has(value);
export const isCuratedPublicSubjectBody=(subject,body)=>
  typeof subject==='string'&&typeof body==='string'&&
  subjectBodyPairs.has(subject+'\0'+body);
