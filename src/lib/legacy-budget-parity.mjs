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
  Object.freeze({key:'role',legacyLabel:'Cargo',previewId:null,review:'FIELD_POLICY_AND_MAPPING_REQUIRED'}),
  Object.freeze({key:'email',legacyLabel:'Email',previewId:'lead-email',review:'FIELD_PRESENT_NOT_VALIDATED'}),
  Object.freeze({key:'telephone',legacyLabel:'Telefone',previewId:'lead-phone',review:'SEPARATE_TELEPHONE_AND_MOBILE_POLICY_REQUIRED'}),
  Object.freeze({key:'mobile',legacyLabel:'Celular',previewId:null,review:'SEPARATE_TELEPHONE_AND_MOBILE_POLICY_REQUIRED'}),
  Object.freeze({key:'message',legacyLabel:'Mensagem',previewId:'lead-details',review:'FIELD_PRESENT_NOT_VALIDATED'}),
  Object.freeze({key:'challenge',legacyLabel:'Verificação aritmética',previewId:null,review:'APPROVED_SERVER_SIDE_ANTIBOT_REPLACEMENT_REQUIRED'})
]);

const allowedControlId=/^lead-[a-z][a-z0-9-]*$/;
function actualPreviewIds(previewHtml){
  if(typeof previewHtml!=='string'||previewHtml.length<1||previewHtml.length>500_000)
    throw new Error('F83: invalid private preview');
  const set=new Set();
  const tagPattern=/<(?:input|select|textarea)\b[^>]*>/gi;
  for(const match of previewHtml.matchAll(tagPattern)){
    const id=match[0].match(/\bid="([^"]+)"/i)?.[1];
    if(id&&allowedControlId.test(id))set.add(id);
  }
  return set;
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
