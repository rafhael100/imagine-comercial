/**
 * F314 — deterministic, READ-ONLY route plan for a future progressive edge
 * transition. Does NOT run a proxy, contact a legacy origin, or configure DNS.
 *
 * Strategic safeguard: keep legacy home/contact forms, all unlisted URLs,
 * all mutating requests and old SEO documents on the original site. Only
 * exact approved Astro HTML paths and content-addressed assets are eligible
 * to be routed to a separate reviewed static origin in private rehearsal.
 *
 * Even a completely verified plan is NOT release authority.
 */
import {sitePages} from '../data/services.mjs';
import {legacyUrls} from '../data/legacy-urls.mjs';

const STATIC_PAGES=Object.freeze(sitePages.map(page=>page.path));
const PAGES=new Set(STATIC_PAGES);
const LEGACY=new Set(legacyUrls.map(item=>item.from));
const SHA=/^[a-f0-9]{64}$/;
const ABSOLUTE_ASSET=/^\/_astro\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.(?:css|js)$/;
const STATIC_FILE=/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}$/;
const RECORD_KEYS=['path','size','sha256'];
const MANIFEST_KEYS=['schema','mode','origin','htmlPages','fileCount',
  'totalBytes','treeSha256','files'];

if(STATIC_PAGES.length!==63 || new Set(STATIC_PAGES).size!==63 ||
  LEGACY.size!==27 || legacyUrls.filter(x=>x.status==='hold').length!==22 ||
  STATIC_PAGES.some(path=>LEGACY.has(path)))
  throw Error('F314: reviewed current or historic route catalog changed');

function exactData(o,fields){
 if(o===null||typeof o!=='object'||Array.isArray(o)||
    Object.getPrototypeOf(o)!==Object.prototype)return false;
 const keys=Reflect.ownKeys(o);
 return keys.length===fields.length&&keys.every(key=>
   typeof key==='string'&&fields.includes(key)&&
   Object.getOwnPropertyDescriptor(o,key)?.enumerable===true&&
   Object.hasOwn(Object.getOwnPropertyDescriptor(o,key),'value'));
}
function dense(arr,length){
 if(!Array.isArray(arr)||Object.getPrototypeOf(arr)!==Array.prototype||
    arr.length!==length||Reflect.ownKeys(arr).length!==length+1)return false;
 return Array.from({length},(_,i)=>Object.getOwnPropertyDescriptor(arr,String(i)))
   .every(d=>d?.enumerable===true&&Object.hasOwn(d,'value'));
}

export function reviewProgressiveOverlayManifest(manifest){
 if(!exactData(manifest,MANIFEST_KEYS)||
    manifest.schema!=='imagine.comercial.release-review.v1'||
    manifest.mode!=='REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY'||
    manifest.origin!=='https://imaginecomunicacao.com.br/'||
    manifest.htmlPages!==63||
    !Number.isSafeInteger(manifest.fileCount)||manifest.fileCount<63||
    manifest.fileCount>300||
    !Number.isSafeInteger(manifest.totalBytes)||manifest.totalBytes<10000||
    manifest.totalBytes>50*1024*1024||
    typeof manifest.treeSha256!=='string'||!SHA.test(manifest.treeSha256)||
    !dense(manifest.files,manifest.fileCount))
    throw Error('F314: untrusted static build manifest');
 const found=new Set(),assets=new Set(),paths=new Set();
 let bytes=0,htmlFiles=0;
 for(const item of manifest.files){
  if(!exactData(item,RECORD_KEYS)||typeof item.path!=='string'||
     !STATIC_FILE.test(item.path)||item.path.includes('..')||
     !Number.isSafeInteger(item.size)||item.size<1||item.size>10*1024*1024||
     typeof item.sha256!=='string'||!SHA.test(item.sha256)||
     found.has(item.path))
    throw Error('F314: invalid or duplicate static asset entry');
  found.add(item.path);bytes+=item.size;
  if(item.path==='index.html'||item.path.endsWith('/index.html')){
   htmlFiles++;
   const path=item.path==='index.html'?'/':
     '/'+item.path.slice(0,-'index.html'.length);
   if(!PAGES.has(path))throw Error('F314: unexpected Astro public HTML route');
   paths.add(path);
  }else if(item.path==='404.html'||item.path==='robots.txt'||
    item.path==='sitemap.xml'){
   // The existing legacy sitemap and robots remain served by the old origin.
  }else{
   const publicPath='/'+item.path;
   if(!ABSOLUTE_ASSET.test(publicPath)&&publicPath!=='/logo-imagine.png')
     throw Error('F314: unreviewed public asset namespace');
   assets.add(publicPath);
  }
 }
 if(bytes!==manifest.totalBytes||htmlFiles!==63||paths.size!==63||
    STATIC_PAGES.some(path=>!paths.has(path))||
    !found.has('404.html')||!found.has('robots.txt')||
    !found.has('sitemap.xml')||!assets.has('/logo-imagine.png')||
    ![...assets].some(path=>path.endsWith('.css'))||
    ![...assets].some(path=>path.endsWith('.js')))
   throw Error('F314: partial or inconsistent progressive overlay package');
 return Object.freeze({
  schema:'imagine.comercial.progressive-legacy-overlay-plan.v1',
  status:'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
  staticTreeSha256:manifest.treeSha256,
  currentStaticHtmlPages:paths.size,
  eligibleNewPages:paths.size-1,
  oldHomepageKept:true,
  oldSeoFilesKept:true,
  heldLegacyRoutesKept:22,
  historicalRedirectCandidatesKeptWithout301:5,
  unlistedRoutesKeptOnOriginal:true,
  formSubmissionsKeptOnOriginal:true,
  eligibleStaticAssets:Object.freeze([...assets].sort()),
  legacyOriginUrl:null,
  newOriginUrl:null,
  originalOriginLiveVerified:false,
  legacyFormsSubmitToApprovedOriginVerified:false,
  oldCssAndJsDependenciesVerified:false,
  newPageCollisionCheckedAgainstLegacy:false,
  originalBackupsAndRollbackVerified:false,
  seoIndexTransitionVerified:false,
  authenticatedPrivateStagingVerified:false,
  deploymentAuthorized:false,
  deploymentPerformed:false,
  redirectsAuthorized:0
 });
}

export function classifyProgressiveOverlayRequest(plan,request){
 if(plan===null||typeof plan!=='object'||
    plan.schema!=='imagine.comercial.progressive-legacy-overlay-plan.v1'||
    plan.status!=='REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY'||
    plan.deploymentAuthorized!==false||plan.deploymentPerformed!==false||
    plan.redirectsAuthorized!==0||
    !Array.isArray(plan.eligibleStaticAssets))
   throw Error('F314: unavailable reviewed overlay plan');
 if(!exactData(request,['method','pathname','search'])||
    typeof request.method!=='string'||
    !/^[A-Z]{3,10}$/.test(request.method)||
    typeof request.pathname!=='string'||request.pathname.length>2048||
    !request.pathname.startsWith('/')||
    /[\u0000-\u001f\u007f]/.test(request.pathname)||
    typeof request.search!=='string'||request.search.length>2048||
    (request.search!==''&&!request.search.startsWith('?'))||
    /[\u0000-\u001f\u007f]/.test(request.search))
   throw Error('F314: invalid route decision input');

 const readOnly=request.method==='GET'||request.method==='HEAD';
 const protectedPath=request.pathname==='/'||
   request.pathname==='/robots.txt'||request.pathname==='/sitemap.xml'||
   LEGACY.has(request.pathname);
 let decision='LEGACY_ORIGIN_RETAIN';
 if(readOnly&&!protectedPath&&PAGES.has(request.pathname))
   decision='REVIEWED_NEW_ASTRO_HTML';
 else if(readOnly&&!protectedPath&&
   plan.eligibleStaticAssets.includes(request.pathname))
   decision='REVIEWED_NEW_ASTRO_ASSET';
 return Object.freeze({
  decision,
  readOnlyRequest:readOnly,
  knownHistoricalRoute:LEGACY.has(request.pathname),
  originalSiteShouldRemainAvailable:true,
  redirectsAuthorized:0,
  deploymentAuthorized:false,
  actualNetworkPerformed:false
 });
}
