/**
 * F38 — verificação OFFLINE de um pacote após a compilação e transporte.
 *
 * O orquestrador fornece, POR CANAL CONFIÁVEL E SEPARADO, alvo, keyId,
 * releaseId, hash do catálogo e hash da árvore. Nenhum deles é deduzido do
 * relatório REVlEW-ONLY contido no próprio pacote.
 *
 * Exige dist/ e artifacts/protected-build-review/ no workspace local.
 * Não conecta Internet, não altera arquivos e não faz deployment.
 */
import {verifyProtectedArtifact} from '../src/lib/protected-artifact-verification.mjs';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {readProtectedDist} from '../src/lib/read-protected-dist.mjs';

function localFile(path,max,label) {
  if(typeof path!=='string' || path.includes('\0'))
    throw new Error('protected artifact: invalid '+label+' path');
  // F216: prevent symlink swap between stat and subsequent read; reject
  // lossy UTF-8 rather than silently replacing signed/review JSON bytes.
  return readApprovedFile(path,max,label);
}
const env=process.env;
const report=JSON.parse(localFile(
  'artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json',
  16*1024,'review'
));
const envelope=JSON.parse(localFile(env.IMAGINE_CATALOG_ENVELOPE_FILE,2*1024*1024,'envelope'));
const publicKey=localFile(env.IMAGINE_CATALOG_PUBLIC_KEY_FILE,16*1024,'public key');
const expectedKeyId=env.IMAGINE_CATALOG_TRUSTED_KEY_ID;
const verified=verifyProtectedArtifact({
  files:readProtectedDist(),review:report,envelope,
  trustKeys:new Map([[expectedKeyId,publicKey]]),
  expectedKeyId,
  expectedTarget:env.IMAGINE_RELEASE_TARGET,
  expectedTreeSha256:env.IMAGINE_EXPECTED_BUILD_TREE_SHA256,
  pins:{
    expectedReleaseId:env.IMAGINE_CATALOG_EXPECTED_RELEASE_ID,
    expectedPayloadSha256:env.IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256
  }
});
console.log('Protected package verified OFFLINE (NOT authorized for deploy):',
  JSON.stringify(verified));
