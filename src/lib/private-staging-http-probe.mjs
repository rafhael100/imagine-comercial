/**
 * F160 — fail-closed, metadata-only preflight for a future private staging.
 * This does not verify IAM/MFA/TLS certificate ownership or authorize deploy.
 * All real probes are opt-in, GET only and unauthenticated.
 */
const HOST=/^staging(?:-[a-z0-9][a-z0-9-]{0,31})?\.imaginecomunicacao\.com\.br$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;

export function parseApprovedStagingOrigin(input){
  if(typeof input!=='string'||input.length>130||!/^https:\/\/[a-z0-9.-]+\/$/.test(input))
    throw Error('F160: explicit canonical private HTTPS staging origin required');
  let parsed;
  try{parsed=new URL(input);}catch{throw Error('F160: malformed private staging origin');}
  if(parsed.protocol!=='https:'||parsed.href!==input||
    parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.port||
    parsed.username||parsed.password||!HOST.test(parsed.hostname))
    throw Error('F160: unapproved private staging origin');
  return parsed.origin;
}

function snapshot(response){
  if(!plain(response)||Object.keys(response).length!==3||
    !['status','robots','cache'].every(k=>Object.hasOwn(response,k))||
    !Number.isSafeInteger(response.status)||response.status<100||
    response.status>599||typeof response.robots!=='string'||
    typeof response.cache!=='string'||response.robots.length>256||
    response.cache.length>256)
    throw Error('F160: invalid bounded HTTP evidence');
  const robots=response.robots.toLowerCase().split(',').map(x=>x.trim());
  const cache=response.cache.toLowerCase().split(',').map(x=>x.trim());
  return Object.freeze({
    status:response.status,
    noindex:robots.includes('noindex'),
    nofollow:robots.includes('nofollow'),
    noStore:cache.includes('no-store')
  });
}
export function reviewPrivateStagingHttpEvidence(input){
  if(!plain(input)||Object.keys(input).length!==3||
     !['homepage','robots','missing'].every(k=>Object.hasOwn(input,k)))
    throw Error('F160: complete private staging evidence required');
  const home=snapshot(input.homepage),robots=snapshot(input.robots),
    missing=snapshot(input.missing);
  const guarded=[home,robots,missing].every(x=>x.noindex&&x.nofollow&&x.noStore);
  const homeProtected=[401,403].includes(home.status);
  const robotsProtected=[401,403].includes(robots.status);
  const missingProtected=[401,403,404].includes(missing.status);
  const status=guarded&&homeProtected&&robotsProtected&&missingProtected
    ?'PRIVATE_GATE_HTTP_EVIDENCE_PRESENT_NOT_LAUNCH_AUTHORIZATION'
    :'BLOCKED_EXPOSURE_OR_INCOMPLETE_STAGING_GATES';
  return Object.freeze({
    schema:'imagine.comercial.staging-http-probe.v1',
    status,
    onlyUnauthenticatedGetReviewed:true,
    source:'OPERATOR_SUPPLIED_OR_PRIVATE_PROBE_NOT_INDEPENDENT_EVIDENCE',
    checks:Object.freeze({
      allResponsesNoindexNoStore:guarded,
      homepagePrivate:homeProtected,
      robotsAccessProtected:robotsProtected,
      missingAccessProtected:missingProtected
    }),
    statusCodes:Object.freeze({homepage:home.status,robots:robots.status,missing:missing.status}),
    stagingSecurityApproved:false,
    certificateOwnershipProved:false,
    mfaAndRbacProved:false,
    portalCrmIntegrationProved:false,
    deploymentAuthorized:false,
    deploymentPerformed:false
  });
}
