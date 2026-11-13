#!/usr/bin/env node
/**
 * F283 — private operator-only comparison between indexed GSC paths and
 * planned legacy-route retention. No network, writes, URLs or metrics logged.
 */
import {resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {crossReviewIndexedCutover} from '../src/lib/private-index-cutover-correlation.mjs';

try{
  if(process.env.GITHUB_ACTIONS==='true')
    throw Error('F283: private source forbidden in CI');
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--file'||
     typeof args[1]!=='string'||!/\.json$/i.test(args[1]))
    throw Error('F283: private source required');
  const payload=JSON.parse(readApprovedFile(resolve(args[1]),2*1024*1024,
    'private normalized GSC and route decisions'));
  console.log(JSON.stringify(crossReviewIndexedCutover(payload),null,2));
}catch{
  process.stderr.write('F283 private migration evidence refused (NO-GO)\n');
  process.exitCode=2;
}
