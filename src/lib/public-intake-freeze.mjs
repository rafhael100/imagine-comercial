/**
 * F76 — PRE-HOMOLOGATION guard for built public files, not a consent engine.
 * This intentionally blocks all public lead intake and outbound programmatic
 * traffic until an independently approved integration supersedes this policy.
 * It has no environment override: CI must fail closed.
 */
const commonForbidden=Object.freeze([
  ['lead endpoint',/\/api\/(?:leads?|orcamentos?)(?:[/?#"' ]|$)/i],
  ['lead capture configuration',/\bPUBLIC_LEAD_CAPTURE_URL\b/],
  ['synthetic intake implementation',/\blead-intake-lab\b/],
  ['programmatic request',/\bfetch\s*\(/],
  ['XHR request',/\bXMLHttpRequest\b/],
  ['beacon request',/\bsendBeacon\s*\(/],
  ['websocket connection',/\bWebSocket\s*\(/],
  ['event stream',/\bEventSource\s*\(/],
  ['dynamic form creation',/\bcreateElement\s*\(\s*['"](?:form|input|textarea)['"]\s*\)/i],
  ['form submission',/\b(?:requestSubmit|HTMLFormElement|FormData)\b|\.\s*submit\s*\(/],
  ['unsafe HTML insertion',/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/],
  ['indexed database',/\bindexedDB\b/],
  ['browser background worker',/\b(?:SharedWorker|BroadcastChannel|serviceWorker)\b/],
  ['cookie access',/\bdocument\s*\.\s*cookie\b/],
  ['local persistence',/\b(?:localStorage|sessionStorage)\b/]
]);

const htmlForbidden=Object.freeze([
  ['form element',/<\s*form\b/i],
  ['input element',/<\s*input\b/i],
  ['textarea element',/<\s*textarea\b/i],
  ['embedded iframe',/<\s*iframe\b/i],
  ['remote script',/<\s*script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i]
]);

/**
 * The approved calculators are deliberately anonymous numeric controls, not
 * lead collection. Only six reviewed numeric/selection IDs are permitted,
 * with no form/submit/network/storage/email/phone/password capabilities.
 * This exception applies to these exact three localized HTML artifacts ONLY.
 */
const CALCULATOR_HTML = new Set([
  'calculadora-de-anuncios/index.html',
  'en/budget-calculator/index.html',
  'es/budget-calculator/index.html'
]);
const BUDGET_VALUES = new Set(['google_ads','meta_ads','chatgpt_ads']);
const NUMBER_IDS = new Set(['lead-goal','intl-leads']);
const MONEY_IDS = new Set(['historic-cpl','monthly-limit','intl-cpl','intl-cap']);
function stripReviewedCalculatorInputs(source) {
  return source.replace(/<\s*input\b[^>]*>/gi,tag=>{
    if (/\bon[a-z]+\s*=|\b(?:form|formaction|src|email|phone|password)\s*=/i.test(tag))
      throw Error('F76: calculator HTML input contains unsafe attributes');
    const type=tag.match(/\btype="([^"]+)"/i)?.[1];
    const id=tag.match(/\bid="([^"]+)"/i)?.[1];
    const name=tag.match(/\bname="([^"]+)"/i)?.[1];
    const value=tag.match(/\bvalue="([^"]+)"/i)?.[1];
    if(type==='checkbox' &&
      (name==='channel'||name==='intl-channel') &&
      id===undefined && BUDGET_VALUES.has(value))
      return '';
    if(type==='number' && NUMBER_IDS.has(id) && name===undefined)
      return '';
    if(type==='text' && MONEY_IDS.has(id) && name===undefined &&
      /\binputmode="decimal"/i.test(tag))
      return '';
    throw Error('F76: calculator contains unreviewed input field');
  });
}

export function assertNoUnapprovedPublicIntake(path,source){
  if(typeof path!=='string'||!path||
     !/\.(?:html|js)$/i.test(path)||typeof source!=='string')
    throw new Error('F76: invalid built asset');
  const calculator=CALCULATOR_HTML.has(path);
  const inspected=calculator ? stripReviewedCalculatorInputs(source) : source;
  const checks=path.toLowerCase().endsWith('.html')
    ? [...htmlForbidden,...commonForbidden] : commonForbidden;
  for(const [description,pattern] of checks){
    if(pattern.test(inspected))throw new Error('F76: blocked '+description+' in '+path);
  }
  return true;
}
