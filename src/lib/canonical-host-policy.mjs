/**
 * F225 — Decisao de produto: host canonico raiz (sem www).
 * Planejamento puro: nao gera regras HTTP, DNS, deploy ou autorizacao de 301.
 * Nunca use esta funcao como prova de cobertura de URLs legadas.
 */
export const CANONICAL_ORIGIN='https://imaginecomunicacao.com.br';
export const HOST_POLICY_STATUS='APPROVED_TARGET_ONLY_REDIRECTS_NOT_AUTHORIZED';

const HOSTS=new Map([
  ['http://imaginecomunicacao.com.br','HTTP_ROOT'],
  ['http://www.imaginecomunicacao.com.br','HTTP_WWW'],
  ['https://www.imaginecomunicacao.com.br','HTTPS_WWW'],
  [CANONICAL_ORIGIN,'HTTPS_ROOT']
]);

export function reviewCanonicalOrigin(origin){
  if(typeof origin!=='string'||!HOSTS.has(origin)){
    throw new TypeError('host policy: expected exact origin from four first-party variants');
  }
  return Object.freeze({
    origin,
    canonicalOrigin:CANONICAL_ORIGIN,
    variant:HOSTS.get(origin),
    canonical:origin===CANONICAL_ORIGIN,
    desiredAction:origin===CANONICAL_ORIGIN?'KEEP_CANONICAL':'REDIRECT_CANDIDATE_REQUIRES_STAGING',
    redirectStatus:'NOT_AUTHORIZED',
    authorizedRedirectRules:0,
    dnsChangeAuthorized:false,
    productionAuthorized:false
  });
}

export function getCanonicalHostPolicy(){
  return Object.freeze({
    contractVersion:'imagine.comercial.host-policy.v1',
    decision:HOST_POLICY_STATUS,
    canonicalOrigin:CANONICAL_ORIGIN,
    variants:Object.freeze([...HOSTS.keys()]),
    authorizedRedirectRules:0,
    dnsChangeAuthorized:false,
    productionAuthorized:false,
    prerequisite:'Verify real HTTP/TLS, legacy path mapping, SEO/GSC, staging and independent security approvals before 301.'
  });
}
