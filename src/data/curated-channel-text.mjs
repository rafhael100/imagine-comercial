/**
 * F159 — single immutable-in-practice lookup of public, predefined text.
 * Both URL constructors and the compiled/DOM allowlists can rely on this
 * policy. No free text, personal data, input forms or network traffic.
 */
import {services} from './services.mjs';
import {contactObjectives} from './contact-objectives.mjs';
import {briefingStages,briefingPriorities,composeCuratedBriefingLinks} from './briefing-curado.mjs';
import {comparisonOptions} from './service-comparison.mjs';
import {composeReviewedComparisonContact} from './comparison-contact.mjs';
import {CALCULATOR_CONTACT_OPTIONS} from './calculator-contact-messages.mjs';
import {localizedSalesMessages} from './localized-sales-messages.mjs';

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
let comparisonPairs=0;
for(let i=0;i<comparisonOptions.length;i++)
for(let j=i+1;j<comparisonOptions.length;j++){
  const {subject,message}=composeReviewedComparisonContact([
    comparisonOptions[i].slug,comparisonOptions[j].slug
  ]);
  messages.add(message);
  subjects.add(subject);
  subjectBodyPairs.add(subject+'\0'+message);
  comparisonPairs++;
}
if(comparisonPairs!==21)throw Error('F188: invalid pair contact catalog');

// F315: seven fixed provider combinations in each of three languages;
// no user-supplied spending amounts, identifiers, free text or PII.
for(const options of Object.values(CALCULATOR_CONTACT_OPTIONS))
  for(const item of options)messages.add(item.message);

// F323: English/Spanish fixed offer-specific contact links; no visitor input.
for(const localeMessages of Object.values(localizedSalesMessages))
  for(const message of Object.values(localeMessages))messages.add(message);


if(combinations!==640||messages.size<35||subjects.size<7)
  throw Error('F159: invalid public curated contact catalog');

export const isCuratedPublicMessage=value=>
  typeof value==='string'&&messages.has(value);
export const isCuratedPublicSubject=value=>
  typeof value==='string'&&subjects.has(value);
export const isCuratedPublicSubjectBody=(subject,body)=>
  typeof subject==='string'&&typeof body==='string'&&
  subjectBodyPairs.has(subject+'\0'+body);
