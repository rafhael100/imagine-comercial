#!/usr/bin/env node
/**
 * F-LEGACY-CAPTURE — opt-in operator-only 27-page read-only HTTP evidence.
 * Writes one exclusive 0600 JSON file OUTSIDE the repository. No deploy,
 * traffic changes, contact submission, CRM or payment integrations.
 */
import {openSync,writeSync,closeSync,constants} from 'node:fs';
import {isAbsolute,resolve,sep} from 'node:path';
import {captureLegacyHttpSnapshot} from '../src/lib/legacy-http-snapshot-capture.mjs';

try{
 const [mode,target]=process.argv.slice(2);
 const local=mode==='--candidate-local';
 if(process.argv.length!==4||!['--original','--candidate-local'].includes(mode)||
   process.env.IMAGINE_LEGACY_HTTP_REVIEW!=='1'||
   process.env.GITHUB_ACTIONS==='true'||
   typeof target!=='string'||!isAbsolute(target)||
   target.includes('\0')||!target.endsWith('.json')||
   resolve(target).startsWith(resolve('.')+sep))
   throw Error('F-LEGACY-CAPTURE: operator-only external file required');
 const password=process.env.IMAGINE_STAGING_REVIEW_PASSWORD;
 const auth=local&&typeof password==='string'?
   'Basic '+Buffer.from('reviewer:'+password).toString('base64'):undefined;
 const snapshot=await captureLegacyHttpSnapshot({
  scope:local?'AFTER_CANDIDATE':'BEFORE_ORIGINAL',
  ...(local?{basicAuth:auth}:{})
 });
 const file=Buffer.from(JSON.stringify(snapshot,null,2)+'\n','utf8');
 let fd;
 try{
  fd=openSync(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  let written=0;
  while(written<file.length)written+=writeSync(fd,file,written,file.length-written);
 }finally{if(fd!==undefined)closeSync(fd);}
 // Never echo URL, body hash, directory, password or HTML.
 console.log('Legacy HTTP snapshot collected for '+snapshot.rows.length+
   ' curated paths; PRIVATE REVIEW ONLY, no redirects or deploy.');
}catch{
 console.error('F-LEGACY-CAPTURE: operator evidence collection unavailable (HOLD)');
 process.exitCode=2;
}
