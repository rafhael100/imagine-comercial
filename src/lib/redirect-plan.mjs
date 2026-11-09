/**
 * Validar um plano explícito de redirecionamentos antigos -> novas páginas.
 * Nenhuma URL ou regra é ativada automaticamente em produção.
 */
import { sitePages } from '../data/services.mjs';

const validPath = /^\/(?:(?:[a-zA-Z0-9._~-]+)\/)*[a-zA-Z0-9._~-]*$/;
const states = new Set(['candidate', 'hold', 'approved']);
// Redirecionamentos legados não podem sequestrar rotas canônicas nem arquivos
// essenciais de indexação, mesmo quando o manifesto marca uma linha como HOLD.
const protectedPaths = new Set(['/robots.txt', '/sitemap.xml', '/404.html']);
const hasDotSegments = path => path.split('/').some(segment => segment === '.' || segment === '..');

export function validateRedirectPlan(entries, {publicPaths = sitePages.map(x=>x.path)} = {}) {
  if (!Array.isArray(entries) || entries.length > 10000) throw new Error('redirects: array required, <=10000 entries');
  const known = new Set(publicPaths);
  const froms = new Set(), redirects = new Map();
  const results = [];
  for (const [index, entry] of entries.entries()) {
    const label = 'entry ' + index;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(label + ': object expected');
    const fields = Object.keys(entry);
    if (fields.some(key=> !['from','to','status','reason'].includes(key))) throw new Error(label + ': unsupported field');
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
  return Object.freeze({ entries:Object.freeze(results), active:Object.freeze(
    [...redirects].map(([from,to])=>Object.freeze({from,to,statusCode:301}))
  )});
}

export function toCloudflareRedirectRules(manifest) {
  if (!manifest || !Array.isArray(manifest.active)) throw new Error('validated manifest required');
  // Isto é apenas uma representação para revisão: não escreve _redirects nem altera DNS.
  return manifest.active.map(({from,to,statusCode})=>from+' '+to+' '+statusCode).join('\n');
}
