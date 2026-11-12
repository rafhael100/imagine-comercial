#!/usr/bin/env node
/**
 * F204: local operator review, not a CMS API and never a deploy action.
 * Eight independent environment inputs; do not pass secrets in argv.
 */
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewSignedCatalogTransition} from '../src/lib/review-signed-catalog-transition.mjs';

const KEYS=Object.freeze({
 previousFile:'IMAGINE_REVIEW_PREVIOUS_ENVELOPE_FILE',
 nextFile:'IMAGINE_REVIEW_NEXT_ENVELOPE_FILE',
 keyFile:'IMAGINE_REVIEW_PUBLIC_KEY_FILE',
 keyId:'IMAGINE_REVIEW_TRUSTED_KEY_ID',
 previousRelease:'IMAGINE_REVIEW_PREVIOUS_RELEASE_ID',
 previousSha:'IMAGINE_REVIEW_PREVIOUS_PAYLOAD_SHA256',
 nextRelease:'IMAGINE_REVIEW_NEXT_RELEASE_ID',
 nextSha:'IMAGINE_REVIEW_NEXT_PAYLOAD_SHA256'
});
function offlineReview(env){
  const vals=Object.fromEntries(Object.entries(KEYS).map(([k,v])=>[k,env[v]]));
  if(Object.values(vals).some(v=>typeof v!=='string'||v.length===0))
    throw Error('missing review input');
  if(!/^[a-z][a-z0-9_-]{4,63}$/.test(vals.keyId))
    throw Error('untrusted key identity');
  const previousEnvelope=JSON.parse(readApprovedFile(vals.previousFile,2*1024*1024,'previous envelope'));
  const nextEnvelope=JSON.parse(readApprovedFile(vals.nextFile,2*1024*1024,'next envelope'));
  const publicKey=readApprovedFile(vals.keyFile,16*1024,'public key');
  const result=reviewSignedCatalogTransition({
    previousEnvelope,nextEnvelope,trustKeys:new Map([[vals.keyId,publicKey]]),
    previousPin:{expectedReleaseId:vals.previousRelease,expectedPayloadSha256:vals.previousSha},
    nextPin:{expectedReleaseId:vals.nextRelease,expectedPayloadSha256:vals.nextSha}
  });
  // The operator only needs aggregate counts and explicit NO-GO. Do not
  // write release identifiers, file paths, content or key PEM to stdout.
  const {previousReleaseId,candidateReleaseId,...sanitized}=result;
  return sanitized;
}
try{
  const outcome=offlineReview(process.env);
  process.stdout.write(JSON.stringify(outcome)+'\n');
}catch{
  // Intentionally redacted: malformed JSON and file I/O errors can include
  // customer-controlled bytes or sensitive absolute paths.
  process.stderr.write('F204: offline signed catalog review refused (NO-GO)\n');
  process.exitCode=1;
}
