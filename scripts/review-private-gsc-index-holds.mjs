#!/usr/bin/env node
/**
 * F276 private Search Console URL Inspection sample review.
 * Operator-supplied normalized JSON: {"inspections":[{"url":"...","verdict":"PASS"}]}.
 * No network, no artifact writes, no raw paths, URLs or GSC metrics in output.
 */
import {resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewIndexedLegacyHoldExposure} from '../src/lib/legacy-index-preservation-review.mjs';

try{
  if(process.env.GITHUB_ACTIONS==='true')
    throw Error('private GSC evidence forbidden in public CI');
  const argv=process.argv.slice(2);
  if(argv.length!==2||argv[0]!=='--file'||!argv[1]?.endsWith('.json'))
    throw Error('F276: private normalized JSON required');
  const source=readApprovedFile(resolve(argv[1]),2*1024*1024,
    'private normalized GSC inspection JSON');
  const result=reviewIndexedLegacyHoldExposure(JSON.parse(source));
  console.log(JSON.stringify(result,null,2));
}catch{
  // Private paths, source, URLs and values are intentionally never logged.
  process.stderr.write('F276 private index inspection refused (NO-GO)\n');
  process.exitCode=2;
}
