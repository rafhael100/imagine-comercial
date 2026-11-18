#!/usr/bin/env node
/**
 * F-LEGACY-HTTP — review TWO externally collected operator-only snapshots.
 * Never approves release. No network, output files, HTML, URLs, body hashes,
 * passwords, DNS, redirect rules or installation.
 */
import {isAbsolute} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewLegacyHttpContinuity} from '../src/lib/legacy-http-continuity-review.mjs';
import {resolveExternalPrivateFilePath} from '../src/lib/external-private-file-path.mjs';
try{
 const args=process.argv.slice(2);
 if(args.length!==4||args[0]!=='--before'||args[2]!=='--after'||
  process.env.IMAGINE_LEGACY_HTTP_REVIEW!=='1'||
  process.env.GITHUB_ACTIONS==='true'||
  !isAbsolute(args[1])||!isAbsolute(args[3])||
  args[1]===args[3])
   throw Error('F-LEGACY-HTTP: private snapshots required');
 const beforePath=resolveExternalPrivateFilePath(args[1]);
 const afterPath=resolveExternalPrivateFilePath(args[3]);
 if(beforePath===afterPath)throw Error('F-LEGACY-HTTP: private snapshots required');
 const before=JSON.parse(readApprovedFile(beforePath,100*1024,'legacy before snapshot'));
 const after=JSON.parse(readApprovedFile(afterPath,100*1024,'legacy after snapshot'));
 const review=reviewLegacyHttpContinuity(before,after);
 // All route names, body fingerprints and original URLs remain in the
 // operator-owned files. Only aggregated counts go to stdout.
 console.log(JSON.stringify(review,null,2));
}catch{
 console.error('F-LEGACY-HTTP: private continuity evidence unavailable (HOLD)');
 process.exitCode=2;
}
