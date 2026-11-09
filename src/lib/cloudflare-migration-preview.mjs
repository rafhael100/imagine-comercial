/**
 * F16 — simulação OFFLINE de redirects no modelo Cloudflare Workers Assets.
 * NUNCA gera arquivos chamados _redirects em public/ ou dist/.
 */
import { validateRedirectPlan, toCloudflareRedirectRules } from './redirect-plan.mjs';
import { sitePages } from '../data/services.mjs';

const MAX_STATIC_REDIRECTS=2000;
const MAX_LINE_LENGTH=1000;
const knownPaths=Object.freeze(sitePages.map(x=>x.path));

export function createMigrationReview(legacyEntries,{publicPaths=knownPaths}={}) {
  const actual=validateRedirectPlan(legacyEntries,{publicPaths});
  if(actual.active.length!==0)throw new Error('migration preview: reviewed candidates only, not activated redirects');
  const candidates=actual.entries.filter(x=>x.status==='candidate');
  const held=actual.entries.filter(x=>x.status==='hold');
  if(candidates.length>MAX_STATIC_REDIRECTS)throw new Error('migration preview: Cloudflare 2,000 static redirect limit exceeded');
  // Converte candidatos em approved SOMENTE na simulação, nunca altera o catálogo
  // persistido, nem cria o arquivo _redirects efetivo.
  const synthetic=actual.entries.map(x=>x.status==='candidate'?{...x,status:'approved'}:x);
  const result=validateRedirectPlan(synthetic,{publicPaths});
  const rules=toCloudflareRedirectRules(result);
  for(const line of rules.split('\n').filter(Boolean)){
    if(line.length>MAX_LINE_LENGTH)throw new Error('migration preview: Cloudflare redirect line exceeds 1,000 characters');
    if(!/^\/[^\s*?#]+ \/[\w./-]+ 301$/.test(line))throw new Error('migration preview: unsupported Cloudflare static redirect format');
  }
  return Object.freeze({
    mode:'SIMULATED_CANDIDATES_NOT_APPROVED_OR_DEPLOYABLE',
    candidateCount:candidates.length,
    heldCount:held.length,
    candidateRules:rules,
    heldPaths:Object.freeze(held.map(x=>x.from)),
    targetRoutes:Object.freeze([...new Set(candidates.map(x=>x.to))])
  });
}
export function simulateMigrationRequest(path,review,{publicPaths=knownPaths}={}) {
  if(!review||review.mode!=='SIMULATED_CANDIDATES_NOT_APPROVED_OR_DEPLOYABLE')throw new Error('migration preview: invalid review object');
  if(typeof path!=='string'||!/^\/[A-Za-z0-9._/-]*$/.test(path))throw new Error('migration preview: unsafe test request path');
  const rule=review.candidateRules.split('\n').find(x=>x.startsWith(path+' '));
  if(rule){
    const [,target,code]=rule.split(' ');
    return Object.freeze({status:Number(code),location:target});
  }
  return Object.freeze({status:publicPaths.includes(path)?200:404,location:null});
}
