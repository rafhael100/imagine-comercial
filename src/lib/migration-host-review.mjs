/**
 * F222 — host-canonical migration decision record. This is an OFFLINE gate
 * only. Inputs are operator-asserted public origins, NOT evidence of current
 * Google indexation, approval, DNS ownership or a tested redirect chain.
 */
const APPROVED_HOSTS=new Set([
  'https://imaginecomunicacao.com.br',
  'https://www.imaginecomunicacao.com.br'
]);
function approvedOrigin(input){
  if(typeof input!=='string'||input.length<10||input.length>100)
    throw Error('host review: exact HTTPS origin required');
  let value;
  try{value=new URL(input);}catch{throw Error('host review: invalid origin');}
  if(!APPROVED_HOSTS.has(value.origin)||value.username||value.password||
      value.protocol!=='https:'||value.search||value.hash||
      value.pathname!=='/'||value.href!==value.origin+'/')
    throw Error('host review: unreviewed host or URL variant');
  return value.origin;
}
export function reviewCanonicalHostMigration({legacyOrigin,candidateOrigin}={}){
  const legacy=approvedOrigin(legacyOrigin);
  const candidate=approvedOrigin(candidateOrigin);
  return Object.freeze({
    schema:'imagine.comercial.host-canonical-migration-review.v1',
    mode:'PUBLIC_ORIGIN_COMPARISON_ONLY',
    legacyOrigin:legacy,
    candidateOrigin:candidate,
    hostChangeProposed:legacy!==candidate,
    requiresPerHostRedirectReview:legacy!==candidate,
    requiresCanonicalSitemapAndHreflangReview:true,
    liveHttpAndTlsVerified:false,
    oldAndNewGscPropertyVerified:false,
    independentSeoApprovalVerified:false,
    dnsChangeAuthorized:false,
    redirectsAuthorized:false,
    canPublish:false,
    deploymentPerformed:false
  });
}
