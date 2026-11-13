#!/usr/bin/env node
/**
 * F224 — safe bounded private Search Console page CSV review, OFFLINE ONLY.
 * Synthetic fixture in CI may write REVIEW-ONLY artifacts; REAL GSC inputs
 * MUST NOT write files inside the repository or run on GitHub Actions.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';

function run(args,env){
  const synthetic=args.length===1&&args[0]==='--synthetic';
  const privateFile=args.length===2&&args[0]==='--file';
  if(!synthetic&&!privateFile)
    throw Error('unreviewed invocation');
  if(privateFile&&env.GITHUB_ACTIONS==='true')
    throw Error('private inputs forbidden in public CI');
  const source=synthetic?'tests/fixtures/gsc-synthetic-pages.csv':args[1];
  if(typeof source!=='string'||!/\.csv$/i.test(source))
    throw Error('invalid CSV input');
  // Exact descriptor + bounded binary read and fatal UTF-8 decode. Do not
  // use readFileSync(path,utf8) for sensitive/attacker-controlled GSC input.
  const csv=readApprovedFile(resolve(source),2*1024*1024,'GSC CSV');
  const result=reviewGscPagesCsv(csv);
  const tag=synthetic?'SYNTHETIC_TEST_DATA':'PRIVATE_LOCAL_CSV_NOT_COMMITTED';
  if(synthetic){
    // CI intentionally retains deterministic synthetic fixtures in
    // Git-ignored artifacts/ for QA. No real GSC export may reach this path.
    const output='artifacts/gsc-review';
    mkdirSync(output,{recursive:true});
    writeFileSync(output+'/gsc-review.json',
      JSON.stringify({
        ...result,
        source:tag,
        warning:'Review only; no redirect approval, network or deployment.'
      },null,2)+'\n',{mode:0o600});
    const lines=[
      '# GSC / SEO legacy URL inventory — REVIEW ONLY','',
      'Data class: '+tag,'Mode: '+result.mode,'',
      '- Imported rows: '+result.inputRows,
      '- Distinct host/path/variant records: '+result.uniqueRows,
      '- Legacy candidates requiring approval: '+result.candidateRows,
      '- Held variants or legacy paths: '+result.heldRows,
      '- Unknown URLs requiring investigation: '+result.unknownRows,
      '- Local legacy paths absent from this export: '+
        result.missingLocalLegacyPaths.length,'',
      'No 301 redirects were activated or generated.',
      'Export data does not prove complete historical URL coverage.'
    ];
    writeFileSync(output+'/REVIEW-ONLY-summary.md',
      lines.join('\n')+'\n',{mode:0o600});
  }
  // Private mode intentionally prints only counts; no output files,
  // URLs, hostnames, filenames, queries, source text or paths are logged.
  console.log('GSC audit OFFLINE review only:',JSON.stringify({
    source:tag,rows:result.inputRows,unique:result.uniqueRows,
    candidates:result.candidateRows,held:result.heldRows,
    unknown:result.unknownRows,deployedRedirects:0
  }));
}
try{run(process.argv.slice(2),process.env);}
catch{
  // Never forward fs/JSON exceptions that may include local paths or bytes.
  process.stderr.write('GSC audit: offline input refused (NO-GO)\n');
  process.exitCode=2;
}
