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

export function assertNoUnapprovedPublicIntake(path,source){
  if(typeof path!=='string'||!path||
     !/\.(?:html|js)$/i.test(path)||typeof source!=='string')
    throw new Error('F76: invalid built asset');
  const checks=path.toLowerCase().endsWith('.html')
    ? [...htmlForbidden,...commonForbidden] : commonForbidden;
  for(const [description,pattern] of checks){
    if(pattern.test(source))throw new Error('F76: blocked '+description+' in '+path);
  }
  return true;
}
