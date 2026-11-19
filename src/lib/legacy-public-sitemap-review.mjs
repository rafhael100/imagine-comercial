/**
 * F359: create a public-only sitemap migration review matrix.
 * All pathnames are pinned from the publicly visible legacy sitemap.
 * No live HTTP, GSC, HTML body, cookies, customer data, redirects or deploy.
 */
import {sitePages} from '../data/services.mjs';
import {legacyUrls} from '../data/legacy-urls.mjs';
import {legacyPublicSitemapPaths,legacyPublicSitemapProvenance}
 from '../data/legacy-public-sitemap-paths.mjs';
import {classifyProgressiveOverlayRequest}
 from './progressive-legacy-overlay-plan.mjs';
const ASTRO=new Set(sitePages.map(page=>page.path));
const CURATED=new Set(legacyUrls.map(row=>row.from));
const req=pathname=>({method:'GET',pathname,search:''});
const formSurface=path=>path==='/contato'||path==='/fale-conosco'||
 path==='/en-us/contact-us'||path==='/component/imaginecontato'||
 path.startsWith('/component/imaginecontato/');

export function buildPublicSitemapPreservationReview(plan){
 if(!plan||Object.getPrototypeOf(plan)!==Object.prototype||
    !Object.isFrozen(plan)||!Object.isFrozen(plan.eligibleStaticAssets)||
    plan.schema!=='imagine.comercial.progressive-legacy-overlay-plan.v1'||
    plan.status!=='REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY'||
    plan.publicSitemapOwnedPathsKept!==81||
    plan.publicSitemapSlashVariantsKept!==161||
    plan.oldHomepageKept!==true||plan.oldContactRouteKept!==true||
    plan.deploymentAuthorized!==false||plan.redirectsAuthorized!==0)
  throw Error('F359: reviewed public sitemap plan required');
 const rows=legacyPublicSitemapPaths.map((path,index)=>{
  const variant=path==='/'?'/':path.endsWith('/')?path:path+'/';
  const original=classifyProgressiveOverlayRequest(plan,req(path));
  const slash=classifyProgressiveOverlayRequest(plan,req(variant));
  if(original.decision!=='LEGACY_ORIGIN_RETAIN'||
     slash.decision!=='LEGACY_ORIGIN_RETAIN')
   throw Error('F359: public legacy sitemap route unexpectedly displaced');
  return Object.freeze({
   row:index+1,path,slashVariant:variant,
   originalHttpSitemapListed:true,
   alsoInCurated27:CURATED.has(path),
   astroExactCollision:ASTRO.has(path),
   astroSlashVariantCollision:ASTRO.has(variant)&&variant!==path,
   legacyFormLikeSurface:formSurface(path),
   exactDecision:original.decision,
   slashDecision:slash.decision,
   httpStatusCheckedByThisOfflineReview:false,
   contentEquivalenceVerified:false,
   formDeliveryVerified:false,
   redirectAuthorized:false
  });
 });
 const direct=rows.filter(x=>x.astroExactCollision),slash=rows.filter(x=>x.astroSlashVariantCollision);
 if(rows.length!==81||direct.length!==1||direct[0].path!=='/'||
    slash.length!==1||slash[0].path!=='/contato')
  throw Error('F359: unexpected sitemap / Astro route collision catalog');
 return Object.freeze({
  schema:'imagine.comercial.public-sitemap-preservation-matrix.v1',
  status:'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
  sourceXmlSha256:legacyPublicSitemapProvenance.sourceXmlSha256,
  orderedPathsSha256:legacyPublicSitemapProvenance.orderedPathsSha256,
  publishedLocEntries:82,validOwnedLocEntries:81,excludedMalformedLocEntries:1,
  protectedPathVariants:plan.publicSitemapSlashVariantsKept,
  astroCompiledPublicPages:63,astroCandidatePages:plan.eligibleNewPages,
  directAstroCollisions:direct.length,
  slashVariantAstroCollisions:slash.length,
  curatedF310PathsIdenticalToSitemapLocs:rows.filter(x=>x.alsoInCurated27).length,
  formLikePathsRequiringOperationalReview:rows.filter(x=>x.legacyFormLikeSurface).length,
  httpStatusCheckedByThisOfflineReview:false,
  publicSitemapSubstitutionApproved:false,
  formDeliveryVerified:false,
  redirectsAuthorized:0,deploymentAuthorized:false,actualNetworkPerformed:false,
  rows:Object.freeze(rows)
 });
}
