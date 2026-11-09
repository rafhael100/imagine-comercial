/**
 * F32 — validação de destinos de hyperlinks no HTML Astro gerado, sem rede.
 * A regra deliberadamente não segue URLs externas nem registra queries em erros.
 * Não substitui crawler/GSC ou prova de que um destino externo está no ar.
 */
import {sitePages,services} from '../data/services.mjs';

const base='http://127.0.0.1:4328';
const destinations=new Set(sitePages.map(x=>x.path));
const intents=new Set(services.map(x=>x.slug));
const waHost='wa.me';
const waPath='/5585996632689';
const emailAddress='imagine@imaginecomunicacao.com.br';
const officePhone='+558530329525';

function failure(currentPath, index, reason) {
  // Never echo the untrusted href: URL queries can contain private tokens.
  throw new Error('F32 link audit: '+currentPath+' link #'+index+': '+reason);
}

function safeExternalChannel(url, channel) {
  if(channel==='https:') {
    if(url.protocol!=='https:' || url.hostname!==waHost ||
       url.pathname!==waPath || url.port || url.username || url.password ||
       url.hash || [...url.searchParams.keys()].some(x=>x!=='text') ||
       [...url.searchParams.keys()].length>1)return false;
    const message=url.searchParams.get('text');
    return message===null ||
      (message.startsWith('Olá,') && message.includes('Imagine') &&
       message.length<=280 && !/[\r\n\0]/.test(message));
  }
  if(channel==='mailto:') {
    if(url.protocol!=='mailto:' || url.pathname.toLowerCase()!==emailAddress ||
       url.hash || [...url.searchParams.keys()].some(x=>x!=='subject') ||
       [...url.searchParams.keys()].length>1)return false;
    const subject=url.searchParams.get('subject');
    return subject===null || (subject.length<=120 &&
      (subject.startsWith('Contato Imagine')||subject.startsWith('Proposta Imagine')) &&
      !/[\r\n\0]/.test(subject));
  }
  if(channel==='tel:') {
    return url.protocol==='tel:' && url.pathname===officePhone &&
      url.search==='' && url.hash==='';
  }
  return false;
}

/**
 * links = attributes extracted from a real browser DOM, not guessed from
 * source templates; allowed routes are the exact curated Astro sitemap.
 * @param {Array<{href:string,target?:string,rel?:string}>} links
 * @param {{currentPath:string,fragmentIds?:string[]}} options
 */
export function reviewPublicLinks(links,{currentPath,fragmentIds=[]}={}) {
  if(!Array.isArray(links) || typeof currentPath!=='string' ||
     !(destinations.has(currentPath)||currentPath==='/404/')) {
    throw new Error('F32 link audit: validated source route required');
  }
  const ids=new Set(fragmentIds);
  const summary={checked:0,internal:0,external:0,sameDocument:0};
  links.forEach((item,index)=>{
    const href=item?.href;
    if(typeof href!=='string' || href!==href.trim() ||
       href==='' || /[\r\n\0\\<>]/.test(href))failure(currentPath,index,'invalid href');
    let url;
    try {
      url=new URL(href,base+currentPath);
    }catch {failure(currentPath,index,'unparseable href');}
    const isInternal=href.startsWith('/') && !href.startsWith('//') ||
      href.startsWith('#');
    if(isInternal) {
      if(!href.startsWith('/')&&!href.startsWith('#'))failure(currentPath,index,'invalid relative URL');
      if(url.origin!==base || url.username || url.password || url.search ||
         href.includes('%') || href.includes('//') ||
         href.split(/[/?#]/).some(x=>x==='.'||x==='..')) {
        failure(currentPath,index,'unsafe or ambiguous internal URL');
      }
      // 404 is deliberately noindex and absent from the public sitemap.
      // Its local skip-to-content anchor is valid, but linking to /404/
      // from another page must never be treated as a public route.
      const local404Anchor=currentPath==='/404/' && href.startsWith('#') &&
        url.pathname==='/404/';
      if(!destinations.has(url.pathname) && !local404Anchor)
        failure(currentPath,index,'internal route missing from sitemap');
      if(url.hash) {
        const fragment=url.hash.slice(1);
        if(url.pathname==='/contato/' && intents.has(fragment)) {
          // Intent hash selects the public contact dropdown, not an HTML ID.
        }else if(url.pathname===currentPath && ids.has(fragment)) {
          // Page-local accessible anchor.
        }else failure(currentPath,index,'broken or unapproved fragment');
      }
      summary.internal++;
      if(href.startsWith('#'))summary.sameDocument++;
      return;
    }
    if(!/^(https|mailto|tel):/i.test(href))
      failure(currentPath,index,'unapproved URL scheme or relative link');
    const channel=url.protocol;
    if(!safeExternalChannel(url,channel))
      failure(currentPath,index,'external destination not in reviewed channel allowlist');
    if((item.target||'').toLowerCase()==='_blank') {
      const rel=new Set(String(item.rel||'').toLowerCase().split(/\s+/));
      if(!rel.has('noopener') || !rel.has('noreferrer'))
        failure(currentPath,index,'new tab lacks noopener noreferrer');
    }else if(item.target && item.target!=='_self') {
      failure(currentPath,index,'unapproved target');
    }
    summary.external++;
  });
  summary.checked=links.length;
  return Object.freeze(summary);
}
