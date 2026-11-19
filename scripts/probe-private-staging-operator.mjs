#!/usr/bin/env node
/**
 * F160 — manual HTTPS diagnostic of a future private staging gate.
 * Never runs in GitHub Actions. Unauthenticated GET-only requests; no secrets.
 * This does NOT publish files, mutate DNS or authorize a production release.
 */
import {parseApprovedStagingOrigin,reviewPrivateStagingHttpEvidence}
  from '../src/lib/private-staging-http-probe.mjs';

if(process.env.GITHUB_ACTIONS==='true')
  throw Error('F160: remote staging probe forbidden in GitHub Actions');
if(process.env.IMAGINE_STAGING_OWNER_ACK!=='STAGING_DIAGNOSTIC_ONLY')
  throw Error('F160: explicit operator acknowledgment required');
if(process.argv.length!==3||!process.argv[2].startsWith('--origin='))
  throw Error('F160: expected --origin=https://staging.imaginecomunicacao.com.br/');
const origin=parseApprovedStagingOrigin(process.argv[2].slice('--origin='.length));
const routes=[['homepage','/'],['robots','/robots.txt'],
  ['missing','/__imagine_diagnostic_nonexistent_page__/']];
const observed={};
for(const [name,path] of routes){
  // No credentials, cookies, headers containing tokens, or request bodies.
  // Redirects are deliberately not followed and fail the private gate.
  const response=await fetch(origin+path,{
    method:'GET',redirect:'manual',cache:'no-store',
    signal:AbortSignal.timeout(6500),
    headers:{Accept:'text/plain,text/html;q=0.8'}
  });
  observed[name]={
    status:response.status,
    robots:response.headers.get('x-robots-tag')||'',
    cache:response.headers.get('cache-control')||''
  };
  await response.body?.cancel();
}
const report=reviewPrivateStagingHttpEvidence(observed);
// Only status codes and booleans; no URLs, cookies, bodies, credentials or PII.
console.log(JSON.stringify(report,null,2));
if(report.status!=='PRIVATE_GATE_HTTP_EVIDENCE_PRESENT_NOT_LAUNCH_AUTHORIZATION')
  process.exitCode=2;
