#!/usr/bin/env node
/**
 * F204: local operator review, not a CMS API and never a deploy action.
 * Eight baseline inputs, or ten when rotating public keys. Never pass
 * secrets in argv. Trusted key IDs and PEM files are distinct per release.
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
const ROTATED=Object.freeze({
 previousKeyFile:'IMAGINE_REVIEW_PREVIOUS_PUBLIC_KEY_FILE',
 previousKeyId:'IMAGINE_REVIEW_PREVIOUS_TRUSTED_KEY_ID',
 nextKeyFile:'IMAGINE_REVIEW_NEXT_PUBLIC_KEY_FILE',
 nextKeyId:'IMAGINE_REVIEW_NEXT_TRUSTED_KEY_ID'
});
const VALID_KEY_ID=/^[a-z][a-z0-9_-]{4,63}$/;
function offlineReview(env){
  const vals=Object.fromEntries(Object.entries(KEYS).map(([k,v])=>[k,env[v]]));
  const rotated=Object.fromEntries(Object.entries(ROTATED).map(([k,v])=>[k,env[v]]));
  const present=v=>typeof v==='string'&&v.length>0;
  const mandatory=[vals.previousFile,vals.nextFile,vals.previousRelease,
    vals.previousSha,vals.nextRelease,vals.nextSha];
  if(mandatory.some(v=>!present(v)))throw Error('missing review input');
  const legacyCount=[vals.keyFile,vals.keyId].filter(present).length;
  const rotationCount=Object.values(rotated).filter(present).length;
  if(!((legacyCount===2&&rotationCount===0)||
       (legacyCount===0&&rotationCount===4)))
    throw Error('ambiguous trusted key configuration');
  let trustKeys;
  if(legacyCount===2){
    if(!VALID_KEY_ID.test(vals.keyId))throw Error('untrusted key identity');
    trustKeys=new Map([[vals.keyId,
      readApprovedFile(vals.keyFile,16*1024,'public key')]]);
  }else{
    if(!VALID_KEY_ID.test(rotated.previousKeyId)||
       !VALID_KEY_ID.test(rotated.nextKeyId)||
       rotated.previousKeyId===rotated.nextKeyId)
      throw Error('invalid rotated key identity');
    trustKeys=new Map([
      [rotated.previousKeyId,
        readApprovedFile(rotated.previousKeyFile,16*1024,'previous public key')],
      [rotated.nextKeyId,
        readApprovedFile(rotated.nextKeyFile,16*1024,'next public key')]
    ]);
  }
  const previousEnvelope=JSON.parse(readApprovedFile(vals.previousFile,2*1024*1024,'previous envelope'));
  const nextEnvelope=JSON.parse(readApprovedFile(vals.nextFile,2*1024*1024,'next envelope'));
  const result=reviewSignedCatalogTransition({
    previousEnvelope,nextEnvelope,trustKeys,
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
