import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {legacyPublicSitemapPaths,legacyPublicSitemapProvenance,legacyPublicSitemapProtectedVariants}
 from '../src/data/legacy-public-sitemap-paths.mjs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';
import {reviewProgressiveOverlayManifest as review,classifyProgressiveOverlayRequest as classify}
 from '../src/lib/progressive-legacy-overlay-plan.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const file=path=>({path,size:1000,sha256:hash(path)});
function syntheticManifest(){
 const files=[
  ...sitePages.map(x=>file(x.path==='/'?'index.html':x.path.slice(1)+'index.html')),
  ...['404.html','robots.txt','sitemap.xml','logo-imagine.png',
    '_astro/BaseLayout.contenthash.css',
    '_astro/InternationalBudgetCalculator.contenthash.js'].map(file)
 ];
 return {
  schema:'imagine.comercial.release-review.v1',
  mode:'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
  origin:'https://imaginecomunicacao.com.br/',
  htmlPages:63,fileCount:files.length,totalBytes:files.length*1000,
  treeSha256:hash('synthetic source, never approved'),
  files
 };
}
const req=(pathname,method='GET',search='')=>({method,pathname,search});

test('F314 accepts an exact, full public build manifest only as a route PLAN',()=>{
 const plan=review(syntheticManifest());
 assert.equal(plan.currentStaticHtmlPages,63);
 assert.equal(plan.eligibleNewPages,61);
 assert.equal(plan.oldContactRouteKept,true);
 assert.equal(plan.publicSitemapOwnedPathsKept,81);
 assert.equal(plan.publicSitemapSlashVariantsKept,161);
 assert.equal(plan.heldLegacyRoutesKept,22);
 assert.equal(plan.historicalRedirectCandidatesKeptWithout301,5);
 assert.equal(plan.oldHomepageKept,true);
 assert.equal(plan.oldSeoFilesKept,true);
 assert.equal(plan.deploymentAuthorized,false);
 assert.equal(plan.deploymentPerformed,false);
 assert.equal(plan.legacyOriginUrl,null);
 assert.equal(plan.newOriginUrl,null);
 assert.equal(plan.redirectsAuthorized,0);
 assert.ok(Object.isFrozen(plan));
 assert.ok(Object.isFrozen(plan.eligibleStaticAssets));
});
test('F314 routes 61 new pages and preserves old homepage and contact variants',()=>{
 const plan=review(syntheticManifest());
 for(const {path} of sitePages){
  for(const method of ['GET','HEAD']){
   const result=classify(plan,req(path,method));
   assert.equal(result.decision,['/','/contato/'].includes(path)?
     'LEGACY_ORIGIN_RETAIN':'REVIEWED_NEW_ASTRO_HTML',path);
   assert.equal(result.actualNetworkPerformed,false);
  }
 }
 for(const query of ['?utm_source=google','?utm_campaign=institucional','?']) {
  assert.equal(classify(plan,req('/en/budget-calculator/','GET',query)).decision,
    'REVIEWED_NEW_ASTRO_HTML');
  assert.equal(classify(plan,req('/','GET',query)).decision,
    'LEGACY_ORIGIN_RETAIN');
 }
});
test('F314 all 27 inventoried legacy URLs, plus old form endpoints and unlisted paths, stay on original',()=>{
 const plan=review(syntheticManifest());
 for(const {from} of legacyUrls){
  for(const method of ['GET','HEAD','POST']){
   const result=classify(plan,req(from,method));
   assert.equal(result.decision,'LEGACY_ORIGIN_RETAIN',from);
   assert.equal(result.knownHistoricalRoute,true);
  }
 }
 for(const path of ['/', '/en-us/', '/fale-conosco.html',
  '/termos-de-uso.html','/robots.txt','/sitemap.xml',
  '/component/imaginecontato/enviar-formulario',
  '/alguma-pagina-ainda-nao-inventariada.html',
  '/_astro/new-malicious-file.js','/en-us/privacidade-extra.html']){
  assert.equal(classify(plan,req(path)).decision,'LEGACY_ORIGIN_RETAIN',path);
 }
});
test('F314 changes and form submissions never go to static Astro',()=>{
 const plan=review(syntheticManifest());
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
  for(const path of ['/en/','/calculadora-de-anuncios/','/_astro/BaseLayout.contenthash.css']){
   assert.equal(classify(plan,req(path,method)).decision,'LEGACY_ORIGIN_RETAIN');
  }
 }
});
test('F314 protects all public legacy sitemap paths plus trailing slash variants',()=>{
 const plan=review(syntheticManifest());
 assert.equal(legacyPublicSitemapPaths.length,81);
 assert.equal(legacyPublicSitemapProtectedVariants.length,161);
 assert.equal(legacyPublicSitemapProvenance.publishedLocEntries,82);
 assert.equal(legacyPublicSitemapProvenance.excludedMalformedLocEntries,1);
 for(const path of legacyPublicSitemapProtectedVariants){
  for(const method of ['GET','HEAD']){
   assert.equal(classify(plan,req(path,method)).decision,'LEGACY_ORIGIN_RETAIN',path);
   assert.equal(classify(plan,req(path,method,'?utm_source=old')).decision,'LEGACY_ORIGIN_RETAIN',path);
  }
 }
 assert.equal(classify(plan,req('/contato/')).decision,'LEGACY_ORIGIN_RETAIN');
 assert.equal(classify(plan,req('/servicos/onepage/')).decision,'REVIEWED_NEW_ASTRO_HTML');
});
test('F314 only exact compiled hashed assets and logo can enter new static origin',()=>{
 const plan=review(syntheticManifest());
 for(const path of ['/_astro/BaseLayout.contenthash.css',
  '/_astro/InternationalBudgetCalculator.contenthash.js',
  '/logo-imagine.png']){
  assert.equal(classify(plan,req(path)).decision,'REVIEWED_NEW_ASTRO_ASSET');
 }
 for(const path of ['/_astro/InternationalBudgetCalculator.fake.js',
  '/_redirects','/_headers','/favicon.ico','/.env','/_astro/.env']){
  assert.equal(classify(plan,req(path)).decision,'LEGACY_ORIGIN_RETAIN');
 }
});
test('F314 rejects malformed, incomplete or injected public build manifests',()=>{
 const base=syntheticManifest();
 const attempts=[];
 const clone=()=>structuredClone(base);
 const missing=clone();missing.files.pop();missing.fileCount--;
 attempts.push(missing);
 const duplicate=clone();duplicate.files[1].path=duplicate.files[0].path;attempts.push(duplicate);
 const foreign=clone();foreign.files[0].path='dangerous/proxy.php';attempts.push(foreign);
 const rewrite=clone();rewrite.files.at(-1).path='_redirects';attempts.push(rewrite);
 const trailing=clone();trailing.fileCount=1000;attempts.push(trailing);
 const extras=clone();extras.productionApproved=true;attempts.push(extras);
 const badHash=clone();badHash.treeSha256='0'.repeat(10);attempts.push(badHash);
 const sparse=clone();delete sparse.files[0];attempts.push(sparse);
 const noLogo=clone();noLogo.files.find(x=>x.path==='logo-imagine.png').path='extra-logo.png';attempts.push(noLogo);
 for(const bad of attempts)
  assert.throws(()=>review(bad),/F314:/);
});
test('F314 rejects getters, prototype injection and malformed request wrappers without reading secrets',()=>{
 const plan=review(syntheticManifest());
 const request=req('/en/');
 Object.defineProperty(request,'method',{enumerable:true,
  get(){throw Error('PRIVATE_SECRET_LEAK')}});
 assert.throws(()=>classify(plan,request),/F314:/);
 const valid=req('/en/');
 Object.setPrototypeOf(valid,{});
 assert.throws(()=>classify(plan,valid),/F314:/);
 for(const invalid of [
  req('/en/','get'),req('https://evil.example/en/'),req('/en/','GET','abc'),
  req('/en/','GET','?x\nBad:Injected'),{...req('/en/'),origin:'https://evil.example'}
 ]){
  assert.throws(()=>classify(plan,invalid),/F314:/);
 }
});

test('F314 even when all route policies are internally valid the production launch report stays NO-GO',()=>{
 const status=JSON.parse(renderReadinessReport(['--target=production']));
 const overlay=status.progressiveLegacyOverlay;
 assert.equal(status.approval,'NOT_AUTHORIZED');
 assert.equal(overlay.listedNewPageCandidates,61);
 assert.equal(overlay.originalContactRouteRetained,true);
 assert.equal(overlay.originalPublicSitemapPathsRetained,81);
 assert.equal(overlay.knownHistoricalRoutesRetained,27);
 assert.equal(overlay.originalHomepageRetained,true);
 assert.equal(overlay.unlistedPathsMustRemainOnOriginal,true);
 assert.equal(overlay.originalContactFormsRemainActiveVerified,false);
 assert.equal(overlay.privateOverlayNoindexVerifiedOnRealEdge,false);
 assert.equal(overlay.oldAndNewSeoHreflangCompatible,false);
 assert.equal(overlay.candidateCloudflareRouteDeployed,false);
 assert.equal(overlay.canReplaceProductionLegacy,false);
});
