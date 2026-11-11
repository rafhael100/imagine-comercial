/**
 * Controle determinístico de versões de catálogo PUBLICÁVEL.
 * Apenas contrato de preparação; autenticação, assinatura, transação e deploy
 * permanecem responsabilidades do Portal e do publicador homologado.
 */
import { validatePublishedCatalog } from './published-catalog.mjs';

function fieldsEqual(a,b) {
  return a.id===b.id && a.slug===b.slug &&
    a.title===b.title && a.description===b.description &&
    a.path===b.path && a.version===b.version &&
    a.status===b.status && a.offerRef===b.offerRef;
}
function sameItems(a,b) {
  if(a.items.length!==b.items.length) return false;
  const byId=new Map(a.items.map(item=>[item.id,item]));
  return b.items.every(item=>byId.has(item.id) && fieldsEqual(byId.get(item.id),item));
}

/**
 * @returns {Object} validated candidate and dry-run change summary.
 * Does not write files, contact Portal, authorize customer data or publish.
 */
export function preparePublication(previousRaw, nextRaw) {
  const next=validatePublishedCatalog(nextRaw);
  if(previousRaw==null) {
    if(next.items.length===0) throw new Error('release: initial publication cannot be empty');
    return Object.freeze({status:'ready',snapshot:next,changes:Object.freeze({added:next.items.length,updated:0,unchanged:0})});
  }
  const prev=validatePublishedCatalog(previousRaw);
  if(prev.releaseId===next.releaseId) {
    if(prev.publishedAt===next.publishedAt && sameItems(prev,next)) {
      return Object.freeze({status:'noop',snapshot:prev,changes:Object.freeze({added:0,updated:0,unchanged:prev.items.length})});
    }
    throw new Error('release: same identifier with different content');
  }
  if(Date.parse(next.publishedAt)<=Date.parse(prev.publishedAt)) throw new Error('release: stale publication date');
  const before=new Map(prev.items.map(item=>[item.id,item]));
  const after=new Map(next.items.map(item=>[item.id,item]));
  let added=0,updated=0,unchanged=0;
  for(const item of next.items) {
    const old=before.get(item.id);
    if(!old) { added++; continue; }
    if(item.version<old.version) throw new Error('release: version rollback for '+item.id);
    if(item.slug!==old.slug || item.path!==old.path) throw new Error('release: slug migration requires reviewed redirect plan for '+item.id);
    if(item.version===old.version) {
      if(!fieldsEqual(item,old)) throw new Error('release: changed content without version bump for '+item.id);
      unchanged++;
    } else updated++;
  }
  for(const item of prev.items) {
    if(!after.has(item.id)) throw new Error('release: removal requires explicit archival approval for '+item.id);
  }
  return Object.freeze({status:'ready',snapshot:next,changes:Object.freeze({added,updated,unchanged})});
}
