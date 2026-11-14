/**
 * READ-ONLY proposal linking existing /en-us/ legacy pages to real /en/ pages.
 * This does not remove any HOLD protection, generate redirects, change DNS
 * or authorize publishing. Legal/portfolio/unoffered service URLs remain
 * unavailable for replacement until distinct content and legal reviews.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';
import {sitePages} from '../data/services.mjs';
import {languageAlternates} from '../data/i18n.mjs';

const proposals=Object.freeze({
  '/en-us/':'/en/',
  '/en-us/contact-us.html':'/en/contact/',
  '/en-us/services/criacao-de-sites-institucional.html':'/en/services/criacao-de-sites/',
  '/en-us/services/facebook-instagram-ads.html':'/en/services/gestao-meta-ads/',
  '/en-us/services/google-ads-anuncios.html':'/en/services/gestao-google-ads/'
});
const original=Object.freeze(legacyUrls.filter(x=>x.from.startsWith('/en-us/')));
const publicPaths=new Set(sitePages.map(x=>x.path));
if(original.length!==12||original.some(x=>x.status!=='hold')||
  Object.keys(proposals).length!==5)throw Error('International legacy inventory changed: review required');
const knownOriginal=new Set(original.map(x=>x.from));
if(Object.keys(proposals).some(path=>!knownOriginal.has(path)))
  throw Error('Uninventoried legacy English migration proposal');
for(const [from,to] of Object.entries(proposals)){
  if(!from.startsWith('/en-us/')||!to.startsWith('/en/')||!publicPaths.has(to)||
    !languageAlternates(to))throw Error('Proposed international target is not reviewed');
}
export function reviewInternationalLegacyCutover(){
  const reviewed=original.map(row=>Object.freeze({
    from:row.from,
    // Not an active redirect. A null value explicitly retains the old route.
    possibleNewPage:proposals[row.from]??null,
    state:'HOLD_RETAIN_ORIGINAL_UNTIL_INDEPENDENT_APPROVAL',
    reason:row.reason
  }));
  return Object.freeze({
    schema:'imagine.comercial.international-legacy-plan.v1',
    originalsReviewed:original.length,
    editorialEquivalentsProposed:Object.keys(proposals).length,
    originalsWithoutEquivalent:original.length-Object.keys(proposals).length,
    entries:Object.freeze(reviewed),
    allLegacyEnglishRoutesRemainHold:true,
    redirectsAuthorized:0,
    redirectsGenerated:0,
    legacyContentPreservedInProductionVerified:false,
    GSCAndBacklinkCoverageVerified:false,
    legalAndEditorialApproval:false,
    canReplaceLegacyEnglishSite:false,
    readyForCutover:false,
    networkPerformed:false
  });
}
