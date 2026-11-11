/**
 * F68: local private JSON file only. No Google API, no CI uploads, no deploy.
 * Throws generic error messages; never echoes raw URLs/queries/tokens.
 */
import {readFileSync,mkdirSync,writeFileSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
import {reviewGscSearchAnalyticsPages} from '../src/lib/gsc-search-analytics-review.mjs';

if(process.env.GITHUB_ACTIONS==='true')
 throw new Error('F68: private GSC export is not permitted in GitHub Actions');
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--file'||!args[1].endsWith('.json'))
 throw new Error('F68: use --file /private/search-analytics-pages.json');
const source=resolve(args[1]);
const bytes=readFileSync(source);
if(bytes.length>2*1024*1024||bytes.length===0)
 throw new Error('F68: private source size refused');
let data;
try{data=JSON.parse(bytes.toString('utf8'));}
catch{throw new Error('F68: malformed private JSON');}
const result=reviewGscSearchAnalyticsPages(data);
const dir='artifacts/gsc-review';
mkdirSync(dir,{recursive:true,mode:0o700});
const path=dir+'/GSC-PRIVATE-REVIEW-ONLY.json';
writeFileSync(path,JSON.stringify(result,null,2)+'\n',{mode:0o600});
chmodSync(path,0o600);
console.log('F68 private GSC offline review:',JSON.stringify({
  total:result.uniqueRows,candidates:result.candidateRows,
  hold:result.heldRows,unknown:result.unknownRows,
  approvedRedirects:0
}));
