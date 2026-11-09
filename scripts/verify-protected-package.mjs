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
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,posix} from 'node:path';
import {verifyProtectedArtifact} from '../src/lib/protected-artifact-verification.mjs';

function localFile(path,max,label) {
  if(typeof path!=='string' || path.includes('\0'))
    throw new Error('protected artifact: invalid '+label+' path');
  const stat=lstatSync(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)
    throw new Error('protected artifact: unsafe '+label+' file');
  return readFileSync(path,'utf8');
}
let totalFiles=0,totalBytes=0;
function readTree(folder='dist',relative='') {
  const root=lstatSync(folder);
  if(!root.isDirectory()||root.isSymbolicLink())
    throw new Error('protected artifact: unsafe package directory');
  const items=readdirSync(folder,{withFileTypes:true});
  const result=[];
  for(const item of items){
    const name=relative?posix.join(relative,item.name):item.name;
    const full=join(folder,item.name);
    const stat=lstatSync(full);
    if(stat.isSymbolicLink())throw new Error('protected artifact: symlink in package');
    if(stat.isDirectory())result.push(...readTree(full,name));
    else if(stat.isFile()&&stat.size<=10*1024*1024){
      totalFiles++;totalBytes+=stat.size;
      if(totalFiles>500||totalBytes>50*1024*1024)
        throw new Error('protected artifact: package size limits exceeded');
      result.push({path:name,bytes:readFileSync(full)});
    }else throw new Error('protected artifact: unexpected package entry');
  }
  return result;
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
  files:readTree(),report,envelope,
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
