/**
 * F83 — public-UI-only inventory of the legacy quote form, observed 2026-11-10.
 *
 * This is not the legacy HTML, an endpoint schema, proof of successful form
 * delivery, verification of required fields, or production authorization.
 * Do not submit real or synthetic data to the legacy form to "test" it.
 */
export const LEGACY_BUDGET_FORM_EVIDENCE=Object.freeze({
  url:'https://www.imaginecomunicacao.com.br/fale-conosco.html',
  observedDate:'2026-11-10',
  evidenceType:'PUBLIC_RENDERED_UI_ONLY',
  submissionOutcome:'NOT_TESTED',
  requiredFieldSemantics:'UNKNOWN',
  antiBotMechanism:'VISIBLE_ARITHMETIC_CHALLENGE_BEHAVIOR_NOT_TESTED'
});

export const LEGACY_BUDGET_FIELDS=Object.freeze([
  Object.freeze({key:'name',legacyLabel:'Nome',previewId:'lead-name',review:'FIELD_PRESENT_NOT_VALIDATED'}),
  Object.freeze({key:'role',legacyLabel:'Cargo',previewId:'lead-role',review:'FIELD_POLICY_AND_MAPPING_REQUIRED'}),
  Object.freeze({key:'email',legacyLabel:'Email',previewId:'lead-email',review:'FIELD_PRESENT_NOT_VALIDATED'}),
  Object.freeze({key:'telephone',legacyLabel:'Telefone',previewId:'lead-phone',review:'SEPARATE_TELEPHONE_AND_MOBILE_POLICY_REQUIRED'}),
  Object.freeze({key:'mobile',legacyLabel:'Celular',previewId:'lead-mobile',review:'SEPARATE_TELEPHONE_AND_MOBILE_POLICY_REQUIRED'}),
  Object.freeze({key:'message',legacyLabel:'Mensagem',previewId:'lead-details',review:'FIELD_PRESENT_NOT_VALIDATED'}),
  Object.freeze({key:'challenge',legacyLabel:'Verificação aritmética',previewId:'lead-challenge',review:'APPROVED_SERVER_SIDE_ANTIBOT_REPLACEMENT_REQUIRED'})
]);

const allowedControlId=/^lead-[a-z][a-z0-9-]*$/;
function actualPreviewIds(previewHtml){
  if(typeof previewHtml!=='string'||previewHtml.length<1||previewHtml.length>500_000)
    throw new Error('F83: invalid private preview');
  // F265: comments and inert/raw-text containers are never live controls.
  // This is deliberately a conservative fixed-fixture review, not an HTML parser.
  const activeMarkup=previewHtml
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  // F267: a private preview hidden at the form/fieldset/dialog/main
  // level cannot claim any visible field merely because child inputs lack
  // individual hidden attributes. Fail closed: a browser still owns actual
  // CSS visibility validation.
  const containerHidden=/<(?:form|fieldset|dialog|main)\b[^>]*(?:\s(?:hidden|inert)(?=[\s=>])|\baria-hidden\s*=\s*["']?true(?:["'\s>])|\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden))/i;
  if(containerHidden.test(activeMarkup))return new Set();
  const counts=new Map();
  const tagPattern=/<(?:input|select|textarea)\b[^>]*>/gi;
  for(const match of activeMarkup.matchAll(tagPattern)){
    const tag=match[0];
    const id=tag.match(/\bid="([^"]+)"/i)?.[1];
    if(!id||!allowedControlId.test(id))continue;
    // F264: a second control with the same ID is ambiguous even if hidden:
    // it can misdirect a <label for> or automated field mapping.
    const obscured=/\s(?:hidden|disabled|inert)(?=[\s=>])/i.test(tag)||
      /\btype\s*=\s*["']?hidden(?:["'\s>])/i.test(tag)||
      /\baria-hidden\s*=\s*["']?true(?:["'\s>])/i.test(tag)||
      /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(tag);
    const old=counts.get(id)||{count:0,visible:false};
    counts.set(id,{count:old.count+1,visible:old.visible||!obscured});
  }
  // A visible control without one matching label is not a usable form field.
  // This remains an offline fixture heuristic, never a substitute for browser QA.
  const labelCounts=new Map();
  for(const match of activeMarkup.matchAll(/<label\b[^>]*>/gi)){
    const tag=match[0];
    const id=tag.match(/\bfor="([^"]+)"/i)?.[1];
    if(!id||!allowedControlId.test(id))continue;
    const hidden=/\s(?:hidden|inert)(?=[\s=>])/i.test(tag)||
      /\baria-hidden\s*=\s*["']?true(?:["'\s>])/i.test(tag)||
      /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(tag);
    const old=labelCounts.get(id)||{count:0,visible:false};
    labelCounts.set(id,{count:old.count+1,visible:old.visible||!hidden});
  }
  return new Set([...counts].filter(([id,row])=>{
    const label=labelCounts.get(id);
    return row.count===1&&row.visible&&label?.count===1&&label.visible;
  }).map(([id])=>id));
}

/**
 * The only supported output is a review of visible controls. Even 7/7
 * matches would not prove collection, delivery, consent, anti-bot or operation.
 */
export function reviewLegacyBudgetPreviewParity(previewHtml){
  const ids=actualPreviewIds(previewHtml);
  const fields=LEGACY_BUDGET_FIELDS.map(entry=>Object.freeze({
    key:entry.key,
    legacyLabel:entry.legacyLabel,
    status:entry.previewId&&ids.has(entry.previewId)
      ? 'VISIBLE_PREVIEW_CONTROL_ONLY' : 'UNRESOLVED_PREVIEW_GAP',
    review:entry.review
  }));
  const gaps=fields.filter(field=>field.status==='UNRESOLVED_PREVIEW_GAP');
  return Object.freeze({
    schema:'imagine.comercial.legacy-budget-ui-parity.v1',
    mode:'OFFLINE_VISUAL_INVENTORY_NOT_OPERATIONAL',
    observedOn:LEGACY_BUDGET_FORM_EVIDENCE.observedDate,
    visibleFields:fields.filter(x=>x.status==='VISIBLE_PREVIEW_CONTROL_ONLY').length,
    observedLegacyFields:fields.length,
    unresolvedFields:Object.freeze(gaps.map(x=>x.key)),
    fields:Object.freeze(fields),
    legacyDeliveryVerified:false,
    portalCrmDeliveryVerified:false,
    legalReviewCompleted:false,
    antiBotOperationallyVerified:false,
    legacyContactIntakeParityApproved:false,
    deploymentAuthorized:false
  });
}
