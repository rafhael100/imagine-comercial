/**
 * F26 — CSV de páginas Search Console, SEM API, SEM rede e SEM _redirects.
 * CI deve usar SOMENTE --synthetic. Arquivos reais permanecem locais e ignorados
 * pelo Git; nunca copiar exportação GSC real para workflow/repositório público.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';

const args=process.argv.slice(2);
if(args.length!==1 && !(args.length===2 && args[0]==='--file')){
  throw new Error('GSC audit: use --synthetic or --file /local/private/export.csv');
}
const synthetic=args.length===1 && args[0]==='--synthetic';
if(!synthetic && args[0]!=='--file')throw new Error('GSC audit: invalid invocation');
const source=synthetic?'tests/fixtures/gsc-synthetic-pages.csv':args[1];
if(!/\.csv$/i.test(source))throw new Error('GSC audit: CSV extension required');
const csv=readFileSync(resolve(source),'utf8');
const result=reviewGscPagesCsv(csv);
const out='artifacts/gsc-review';
mkdirSync(out,{recursive:true});
const report={
  ...result,
  warning:'Review-only. No redirect approval, no remote service, no deployment.',
  source:synthetic?'SYNTHETIC_TEST_DATA':'PRIVATE_LOCAL_CSV_NOT_COMMITTED'
};
writeFileSync(out+'/gsc-review.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
const lines=[
  '# GSC / SEO legacy URL inventory — REVIEW ONLY',
  '',
  'Data class: '+report.source,
  'Mode: '+report.mode,
  '',
  '- Imported rows: '+result.inputRows,
  '- Distinct host/path/variant records: '+result.uniqueRows,
  '- Legacy candidates requiring approval: '+result.candidateRows,
  '- Held variants or legacy paths: '+result.heldRows,
  '- Unknown URLs requiring investigation: '+result.unknownRows,
  '- Local legacy paths absent from this export: '+result.missingLocalLegacyPaths.length,
  '',
  'No 301 redirects were activated or generated.',
  'Export data does not prove complete historical URL coverage.',
  'Do not upload actual GSC export or this output to a public CI or repository.'
];
writeFileSync(out+'/REVIEW-ONLY-summary.md',lines.join('\n')+'\n',{mode:0o600});
console.log('GSC audit OFFLINE review only:',JSON.stringify({
  source:report.source,rows:result.inputRows,
  unique:result.uniqueRows,candidates:result.candidateRows,
  held:result.heldRows,unknown:result.unknownRows,
  deployedRedirects:0
}));
