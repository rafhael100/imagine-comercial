/**
 * F32 — validação de destinos de hyperlinks no HTML Astro gerado, sem rede.
 * A regra deliberadamente não segue URLs externas nem registra queries em erros.
 * Não substitui crawler/GSC ou prova de que um destino externo está no ar.
 */
import {sitePages,services} from '../data/services.mjs';
import {resolvePortalLoginLink} from './portal-login-link.mjs';
import {contactChannels} from '../data/contact-channels.mjs';
import {commercialFaqSections} from '../data/commercial-faq.mjs';
import {comparisonOptions} from '../data/service-comparison.mjs';
import {encodeReviewedComparisonFragment} from '../data/reviewed-comparison-fragment.mjs';
import {guideGoals} from './public-service-guide.mjs';
import {encodeReviewedGoalFragment} from '../data/reviewed-goal-fragment.mjs';
import {isApprovedPublicExternalHref} from './outbound-link-contract.mjs';

const base='http://127.0.0.1:4328';
const destinations=new Set(sitePages.map(x=>x.path));
const intents=new Set(services.map(x=>x.slug));
// F190: cross-page FAQ anchors are valid ONLY for curated question IDs.
// Do not relax the rule for arbitrary paths, sections or user-supplied hashes.
const approvedFaqAnchors=new Set(commercialFaqSections.flatMap(section=>
  section.questions.map(item=>'duvida-'+item.id)
));
// Exactly fifteen public unordered pairs are permitted, never arbitrary URL
// fragments, visitor text, or a data-driven redirect to an unknown page.
const approvedComparisonHashes=new Set();
for(let i=0;i<comparisonOptions.length;i++)
for(let j=i+1;j<comparisonOptions.length;j++)
  approvedComparisonHashes.add(encodeReviewedComparisonFragment([
    comparisonOptions[i].slug,comparisonOptions[j].slug
  ]).slice(1));
if(approvedComparisonHashes.size!==15)
  throw Error('F195: invalid comparison fragment catalog');
const approvedGoalHashes=new Set(guideGoals.map(goal=>
  encodeReviewedGoalFragment(goal.code).slice(1)));
if(approvedGoalHashes.size!==5)
  throw Error('F196: invalid public objective links');
const waHost='wa.me';
const waPath='/'+contactChannels.whatsappE164;
const emailAddress=contactChannels.email;
const officePhone=contactChannels.phoneE164;

function failure(currentPath, index, reason) {
  // Never echo the untrusted href: URL queries can contain private tokens.
  throw new Error('F32 link audit: '+currentPath+' link #'+index+': '+reason);
}

/**
 * links = attributes extracted from a real browser DOM, not guessed from
 * source templates; allowed routes are the exact curated Astro sitemap.
 * @param {Array<{href:string,target?:string,rel?:string}>} links
 * @param {{currentPath:string,fragmentIds?:string[],approvedPortalLoginUrl?:string}} options
 */
export function reviewPublicLinks(links,{currentPath,fragmentIds=[],approvedPortalLoginUrl=''}={}) {
  if(!Array.isArray(links) || typeof currentPath!=='string' ||
     !(destinations.has(currentPath)||currentPath==='/404/')) {
    throw new Error('F32 link audit: validated source route required');
  }
  const ids=new Set(fragmentIds);
  const approvedPortalLink=resolvePortalLoginLink(approvedPortalLoginUrl);
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
        }else if(url.pathname==='/servicos/' &&
                  approvedGoalHashes.has(fragment)) {
          // Only an editorial business goal, never user data or search text.
        }else if(url.pathname==='/comparar-solucoes/' &&
                  approvedComparisonHashes.has(fragment)) {
          // A canonical, two-service editorial comparison without visitor data.
        }else if(url.pathname==='/perguntas-frequentes/' &&
                  approvedFaqAnchors.has(fragment)) {
          // Reviewed public FAQ question anchors, stable across pages.
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
    const exactApprovedPortal=approvedPortalLink!=='' &&
      href===approvedPortalLink && channel==='https:';
    // F159: public browser QA must enforce the same exact curated output
    // as the generated-HTML audit. A valid Portal host alone does not grant
    // access; the link must also equal the explicitly configured build URL.
    const portalCandidate=resolvePortalLoginLink(href)!=='';
    if((portalCandidate&&!exactApprovedPortal)||
       (!exactApprovedPortal&&!isApprovedPublicExternalHref(href)))
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
