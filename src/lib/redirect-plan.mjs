/**
 * Validar um plano explícito de redirecionamentos antigos -> novas páginas.
 * Nenhuma URL ou regra é ativada automaticamente em produção.
 */
import { sitePages } from '../data/services.mjs';
import {legacyUrls} from '../data/legacy-urls.mjs';

const validPath = /^\/(?:(?:[a-zA-Z0-9._~-]+)\/)*[a-zA-Z0-9._~-]*$/;
const states = new Set(['candidate', 'hold', 'approved']);
// F278: a source HOLD is a deliberate product/SEO block, not a flag that
// another caller may elevate merely by supplying status:'approved'.
const heldLegacyPaths=new Set(legacyUrls.filter(x=>x.status==='hold').map(x=>x.from));
// F280: the final review-rule renderer may only emit individually inventoried
// candidate sources. A valid arbitrary path is NOT a reviewed migration URL.
const candidateLegacyPaths=new Set(legacyUrls.filter(x=>x.status==='candidate').map(x=>x.from));
// Redirecionamentos legados não podem sequestrar rotas canônicas nem arquivos
// essenciais de indexação, mesmo quando o manifesto marca uma linha como HOLD.
const protectedPaths = new Set(['/robots.txt', '/sitemap.xml', '/404.html']);
const hasDotSegments = path => path.split('/').some(segment => segment === '.' || segment === '..');
// F279: validation result capability must not be reconstructed by JSON or a
// caller-supplied `{active:[...]}` that could inject unreviewed redirect text.
const issuedPlans=new WeakSet();

/**
 * F282 — Only inspect own, enumerable data properties of a plain object.
 * Getters, inherited fields, symbols and hidden review flags are not
 * trustworthy sources for redirect decisions. Never invoke an accessor.
 */
const FIELDS=new Set(['from','to','status','reason']);
function plainRedirectEntry(value){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
    Object.getPrototypeOf(value)!==Object.prototype)return false;
  const keys=Reflect.ownKeys(value);
  if(keys.length!==4)return false;
  return keys.every(key=>{
    if(typeof key!=='string'||!FIELDS.has(key))return false;
    const desc=Object.getOwnPropertyDescriptor(value,key);
    return desc?.enumerable===true&&Object.hasOwn(desc,'value');
  });
}


export function validateRedirectPlan(entries, {publicPaths = sitePages.map(x=>x.path)} = {}) {
  if (!Array.isArray(entries) || entries.length > 10000) throw new Error('redirects: array required, <=10000 entries');
  const known = new Set(publicPaths);
  const froms = new Set(), redirects = new Map();
  const results = [];
  for (const [index, entry] of entries.entries()) {
    const label = 'entry ' + index;
    if (!plainRedirectEntry(entry))
      throw new Error(label + ': own-data redirect object required');
    if (typeof entry.from !== 'string' || !validPath.test(entry.from) || entry.from.includes('//') ||
        entry.from.startsWith('/./') || entry.from.includes('/../') || entry.from === '/' ||
        /[*?#\\]/.test(entry.from) || hasDotSegments(entry.from)) throw new Error(label + ': invalid source');
    if (known.has(entry.from) || protectedPaths.has(entry.from) ||
        entry.from === '/.well-known' || entry.from.startsWith('/.well-known/')) {
      throw new Error(label + ': source conflicts with a published or reserved route');
    }
    if (froms.has(entry.from)) throw new Error(label + ': duplicate source');
    froms.add(entry.from);
    if (!states.has(entry.status)) throw new Error(label + ': invalid state');
    if (heldLegacyPaths.has(entry.from) && entry.status!=='hold')
      throw new Error(label + ': inventoried HOLD route cannot become a redirect');
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 15) throw new Error(label + ': reason required');
    if (entry.status === 'hold') {
      if (entry.to !== null) throw new Error(label + ': hold must have null destination');
    } else {
      if (typeof entry.to !== 'string' || !validPath.test(entry.to) ||
          !entry.to.endsWith('/') || entry.to.includes('//') ||
          /[*?#\\]/.test(entry.to)) throw new Error(label + ': invalid target');
      if (entry.from === entry.to) throw new Error(label + ': self redirect');
      if (!known.has(entry.to)) throw new Error(label + ': destination not part of published public routes');
      if (entry.status === 'approved') redirects.set(entry.from,entry.to);
    }
    results.push(Object.freeze({ from:entry.from,to:entry.to,status:entry.status,reason:entry.reason }));
  }
  // Não produzir cadeias ou laços; aprovar origem somente se destino for página final.
  for (const [from, to] of redirects) {
    if (froms.has(to)) throw new Error('redirects: chain or loop through ' + to);
  }
  const plan=Object.freeze({ entries:Object.freeze(results), active:Object.freeze(
    [...redirects].map(([from,to])=>Object.freeze({from,to,statusCode:301}))
  )});
  issuedPlans.add(plan);
  return plan;
}

export function toCloudflareRedirectRules(manifest) {
  if (!manifest || !issuedPlans.has(manifest))
    throw new Error('validated manifest required');
  if(manifest.active.some(rule=>!candidateLegacyPaths.has(rule.from)))
    throw new Error('redirects: unreviewed source cannot generate a 301 rule');
  // Isto é apenas uma representação para revisão: não escreve _redirects nem altera DNS.
  return manifest.active.map(({from,to,statusCode})=>from+' '+to+' '+statusCode).join('\n');
}
