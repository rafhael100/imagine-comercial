/**
 * Gera apenas artefatos de revisão. Nunca escreve arquivos _redirects reais.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {createMigrationReview,simulateMigrationRequest} from '../src/lib/cloudflare-migration-preview.mjs';

const folder='artifacts/migration-preview';
const review=createMigrationReview(legacyUrls);
if(review.heldCount<1||review.candidateCount<1)throw new Error('migration preview: expected held and candidate entries');
for(const line of review.candidateRules.split('\n').filter(Boolean)){
  const [from,to]=line.split(' ');
  const simulated=simulateMigrationRequest(from,review);
  if(simulated.status!==301||simulated.location!==to)throw new Error('migration preview: simulated 301 mismatch');
}
for(const path of review.heldPaths){
  if(simulateMigrationRequest(path,review).status===301)throw new Error('migration preview: HOLD redirected');
}
if(simulateMigrationRequest('/outra-pagina-antiga.html',review).status!==404)throw new Error('migration preview: unknown URL not 404');
await mkdir(folder,{recursive:true});
await writeFile(folder+'/REVIEW-ONLY-redirects.preview.txt',
 '# SIMULATED CANDIDATES - NOT APPROVED / DO NOT DEPLOY\n'+review.candidateRules+'\n');
await writeFile(folder+'/migration-review.json',JSON.stringify(review,null,2)+'\n');
console.log('Offline migration preview passed:',JSON.stringify({
  candidates:review.candidateCount,held:review.heldCount,
  state:'SIMULATION_ONLY_NO_REDIRECTS_DEPLOYED'
}));
