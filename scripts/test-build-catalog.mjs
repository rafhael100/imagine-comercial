/**
 * Teste integrativo: compilar Astro com snapshot público assinado fictício,
 * comprovar atualização do HTML, rejeitar assinatura falsificada e restaurar build normal.
 * Chaves de teste são geradas em memória; nenhum segredo entra no repositório.
 */
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {createSignedBuildReview} from '../src/lib/signed-build-review.mjs';
import {verifyProtectedReleaseWithWitness} from '../src/lib/protected-release-witness.mjs';
import {receiptSigningBytes} from '../src/lib/independent-delivery-receipt.mjs';
import {witnessPolicySigningBytes} from '../src/lib/signed-witness-trust-policy.mjs';
import {createSyntheticAtomicLedger} from '../src/lib/atomic-receipt-ledger.mjs';

if (process.env.IMAGINE_RELEASE_TARGET &&
    process.env.IMAGINE_RELEASE_TARGET!=='review') {
  throw new Error('F37: synthetic CI test must not run as staging/production task');
}
const label='Landing Pages empresariais atualizadas no CMS';
const description='Descrição pública validada por assinatura durante o build Astro, utilizada apenas como demonstração sem dados de clientes.';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const pem=publicKey.export({format:'pem',type:'spki'}).toString();
const root=mkdtempSync(join(tmpdir(),'imagine-f9-ci-'));
const envelopePath=join(root,'envelope.json'),keyPath=join(root,'key.pem');
const domain=Buffer.from('imagine-commercial-catalog-v1\0','utf8');
const snapshot={
  schemaVersion:'1.0',releaseId:'release_20261109_ci',
  publishedAt:'2026-11-09T03:00:00Z',
  items:[{id:'service_landing_ci',slug:'landing-pages',path:'/servicos/landing-pages/',
    status:'published',version:2,title:label,description}]
};
const bytes=Buffer.from(JSON.stringify(snapshot));
const signature=sign(null,Buffer.concat([domain,bytes]),privateKey);
const envelope={protocol:'imagine-catalog-v1',keyId:'portal_test_ci_01',
  payloadBase64:bytes.toString('base64'),signatureBase64:signature.toString('base64')};
writeFileSync(keyPath,pem);
writeFileSync(envelopePath,JSON.stringify(envelope));
const env={...process.env,IMAGINE_CATALOG_ENVELOPE_FILE:envelopePath,
  IMAGINE_CATALOG_PUBLIC_KEY_FILE:keyPath,
  IMAGINE_CATALOG_TRUSTED_KEY_ID:'portal_test_ci_01',
  IMAGINE_CATALOG_EXPECTED_RELEASE_ID:snapshot.releaseId,
  IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:createHash('sha256').update(bytes).digest('hex'),
  IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
  IMAGINE_RELEASE_TARGET:'staging'};
const buildEnv={...process.env};
delete buildEnv.IMAGINE_CATALOG_ENVELOPE_FILE;
delete buildEnv.IMAGINE_CATALOG_PUBLIC_KEY_FILE;
delete buildEnv.IMAGINE_CATALOG_TRUSTED_KEY_ID;
delete buildEnv.IMAGINE_CATALOG_EXPECTED_RELEASE_ID;
delete buildEnv.IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256;
delete buildEnv.IMAGINE_CATALOG_REQUIRE_SIGNED;
delete buildEnv.IMAGINE_RELEASE_TARGET;
const astro='node_modules/.bin/astro';
function readDistFiles(dir='dist',prefix='') {
  const out=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const rel=prefix?prefix+'/'+entry.name:entry.name;
    const path=join(dir,entry.name);
    if(entry.isDirectory())out.push(...readDistFiles(path,rel));
    else if(entry.isFile())out.push({path:rel,bytes:readFileSync(path)});
    else throw new Error('F24: unsupported dist entry '+rel);
  }
  return out;
}
try {
  // O ensaio assinado precisa atravessar o entrypoint do futuro release
  // build, não apenas chamar Astro diretamente (F37).
  execFileSync(process.execPath,['scripts/build-protected-release.mjs'],{
    env,stdio:'pipe',timeout:120000
  });
  const protectedProof=JSON.parse(readFileSync(
    'artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json','utf8'
  ));
  assert.equal(protectedProof.target,'staging');
  assert.equal(protectedProof.releaseId,snapshot.releaseId);
  assert.equal(protectedProof.deploymentPerformed,false);
  assert.match(protectedProof.mode,/NOT_AUTHORIZED_FOR_DEPLOY/);
  assert.match(protectedProof.compiledTreeSha256,/^[a-f0-9]{64}$/);
  // F38: a segunda etapa não pode confiar no hash escrito dentro do
  // relatório; exige pin de árvore entregue por fonte independente.
  const verifyEnv={
    ...env,IMAGINE_EXPECTED_BUILD_TREE_SHA256:protectedProof.compiledTreeSha256
  };
  const verifyArtifact=envForReview=>execFileSync(process.execPath,
    ['scripts/verify-protected-package.mjs'],{
      env:envForReview,stdio:'pipe',timeout:120000
    });
  const verifiedOutput=verifyArtifact(verifyEnv).toString('utf8');
  assert.match(verifiedOutput,/OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY/);
  // F47: genuine combined call to the F38 and F45 verifiers, using the
  // compiled Astro output and ephemeral, mutually distinct Ed25519 keys.
  const trustRoot=generateKeyPairSync('ed25519');
  const deliveryWitness=generateKeyPairSync('ed25519');
  const witnessPublicPem=deliveryWitness.publicKey.export({
    type:'spki',format:'pem'
  }).toString();
  const rootPublicPem=trustRoot.publicKey.export({
    type:'spki',format:'pem'
  }).toString();
  const labNow=1800000000;
  const trustedRelease={
    releaseId:snapshot.releaseId,target:'staging',
    treeSha256:protectedProof.compiledTreeSha256,
    witnessKeyId:'witness_f47_lab_01'
  };
  const trustPolicy={
    schema:'imagine.comercial.witness-trust-window.v1',
    witnessKeyId:trustedRelease.witnessKeyId,
    publicKeyPem:witnessPublicPem,state:'active',
    validFrom:labNow-100,validUntil:labNow+100
  };
  const unsignedPolicy={
    schema:'imagine.comercial.signed-witness-policy.v1',
    signerKeyId:'trust_root_f47_01',sequence:7,policy:trustPolicy
  };
  const witnessPolicyEnvelope={...unsignedPolicy,signature:sign(
    null,witnessPolicySigningBytes(unsignedPolicy),trustRoot.privateKey
  ).toString('base64')};
  const unsignedReceipt={
    schema:'imagine.comercial.delivery-receipt.v1',
    ...trustedRelease,issuedAt:labNow,nonce:'c'.repeat(64)
  };
  const deliveryReceipt={...unsignedReceipt,signature:sign(
    null,receiptSigningBytes(unsignedReceipt),deliveryWitness.privateKey
  ).toString('base64')};
  const replayLedger=createSyntheticAtomicLedger();
  const f47Inputs={
    files:readDistFiles(),review:protectedProof,envelope,
    catalogTrustKeys:new Map([[envelope.keyId,pem]]),
    expectedCatalogKeyId:envelope.keyId,
    catalogPins:{
      expectedReleaseId:snapshot.releaseId,
      expectedPayloadSha256:env.IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256
    },
    expectedRelease:trustedRelease,receipt:deliveryReceipt,
    witnessPolicyEnvelope,
    rootKeys:new Map([['trust_root_f47_01',rootPublicPem]]),
    expectedRootKeyId:'trust_root_f47_01',
    minPolicySequence:7,publisherKeyId:'portal_test_ci_01',
    nowSeconds:labNow,ledger:replayLedger
  };
  // A corrupt package must never consume the synthetic receipt nonce.
  const corrupted=readDistFiles().map(file=>file.path==='index.html'
    ? {...file,bytes:Buffer.concat([file.bytes,Buffer.from('tampered')])}
    : file);
  await assert.rejects(
    verifyProtectedReleaseWithWitness({...f47Inputs,files:corrupted}),
    /digest|hash|mismatch/
  );
  const bound=await verifyProtectedReleaseWithWitness(f47Inputs);
  assert.equal(bound.releaseId,snapshot.releaseId);
  assert.equal(bound.treeSha256,trustedRelease.treeSha256);
  assert.equal(bound.replayReserved,true);
  assert.equal(bound.deploymentAuthorized,false);
  assert.equal(bound.deploymentPerformed,false);
  await assert.rejects(verifyProtectedReleaseWithWitness(f47Inputs),/replay rejected/);
  console.log('F47 lab E2E: protected Astro bytes + root-signed witness + replay rejection PASS.');

  assert.throws(()=>verifyArtifact({
    ...verifyEnv,IMAGINE_EXPECTED_BUILD_TREE_SHA256:'a'.repeat(64)
  }),/Command failed|status/);
  assert.throws(()=>verifyArtifact({
    ...verifyEnv,IMAGINE_CATALOG_EXPECTED_RELEASE_ID:'release_wrong_verification'
  }),/Command failed|status/);
  assert.throws(()=>verifyArtifact({
    ...verifyEnv,IMAGINE_RELEASE_TARGET:'review'
  }),/Command failed|status/);
  const outputReview='artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json';
  const originalReview=readFileSync(outputReview,'utf8');
  writeFileSync(outputReview,JSON.stringify({...protectedProof,
    compiledTreeSha256:'f'.repeat(64)}));
  assert.throws(()=>verifyArtifact(verifyEnv),/Command failed|status/);
  writeFileSync(outputReview,originalReview);
  // Tampering with any static HTML file changes the tree even if signed
  // service metadata remains unchanged and the review JSON is untouched.
  const originalHome=readFileSync('dist/index.html');
  writeFileSync('dist/index.html',
    Buffer.concat([originalHome,Buffer.from('\n<!-- altered after build -->')]));
  assert.throws(()=>verifyArtifact(verifyEnv),/Command failed|status/);
  writeFileSync('dist/index.html',originalHome);
  assert.match(verifyArtifact(verifyEnv).toString('utf8'),
    /OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY/);
  console.log('F38 independent verifier accepted pinned package and rejected tampered tree/report/pins.');
  const built=readFileSync('dist/servicos/landing-pages/index.html','utf8');
  assert.ok(built.includes(label),'Build must use signed metadata title');
  assert.ok(built.includes(description),'Build must use signed public intro');
  assert.ok(!built.includes('portal_test_ci_01'),'Public HTML must not expose signing key ID');
  // F24: o lote assinado precisa produzir os mesmos metadados da página entregue,
  // e o digest precisa refletir os bytes do pacote compilado, não só o JSON.
  const signedFiles=readDistFiles();
  const proof=createSignedBuildReview(signedFiles,envelope,
    new Map([[envelope.keyId,pem]]),{
      expectedReleaseId:snapshot.releaseId,
      expectedPayloadSha256:env.IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256
    });
  assert.equal(proof.releaseId,snapshot.releaseId);
  assert.equal(proof.verifiedServiceCount,1);
  assert.match(proof.treeSha256,/^[a-f0-9]{64}$/);
  const tamperedFiles=signedFiles.map(file=>file.path==='servicos/landing-pages/index.html'
    ? {...file,bytes:Buffer.from(file.bytes.toString('utf8').replace(label,'Texto adulterado'))}
    : file);
  assert.throws(()=>createSignedBuildReview(tamperedFiles,envelope,
    new Map([[envelope.keyId,pem]]),{
      expectedReleaseId:snapshot.releaseId,
      expectedPayloadSha256:env.IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256
    }),/HTML title differs|description differs|intro differs/);
  console.log('F24 signed HTML/build binding verified, SHA-256:',proof.treeSha256);

  // F25: mesmo que todos os campos da configuração desapareçam da execução,
  // a intenção signed-required precisa impedir retorno ao catálogo editorial.
  const missingAll={...env};
  for(const name of ['IMAGINE_CATALOG_ENVELOPE_FILE',
    'IMAGINE_CATALOG_PUBLIC_KEY_FILE','IMAGINE_CATALOG_TRUSTED_KEY_ID',
    'IMAGINE_CATALOG_EXPECTED_RELEASE_ID','IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256']){
    delete missingAll[name];
  }
  assert.throws(()=>execFileSync(astro,['build'],{
    env:missingAll,stdio:'pipe',timeout:60000
  }),/Command failed|status/);
  console.log('F25 signed-required mode rejected fully missing catalog configuration.');

  // Nem o CLI de build protegido pode ser executado em modo review nem
  // com produção declarada mas sem intenção signed-required explícita.
  for(const cliEnv of [
    buildEnv,
    {...buildEnv,IMAGINE_RELEASE_TARGET:'production'},
    {...env,IMAGINE_RELEASE_TARGET:'production',
      IMAGINE_CATALOG_REQUIRE_SIGNED:'0'}
  ]){
    assert.throws(()=>execFileSync(process.execPath,
      ['scripts/build-protected-release.mjs'],{
        env:cliEnv,stdio:'pipe',timeout:120000
      }),/Command failed|status/);
  }
  assert.equal(existsSync('dist'),false,
    'F37 invalid protected run must never leave an older publishable dist tree');
  assert.equal(existsSync('artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json'),
    false,'F37 invalid protected run must never leave stale verification evidence');
  console.log('F37 protected CLI refused review, unsigned production and disabled signing mode.');

  // F37: alvo staging/production declarado nunca faz fallback editorial
  // e exige que o modo signed-required tenha sido explicitamente ativado.
  for(const target of ['staging','production']){
    assert.throws(()=>execFileSync(astro,['build'],{
      env:{...buildEnv,IMAGINE_RELEASE_TARGET:target},
      stdio:'pipe',timeout:60000
    }),/Command failed|status/);
    assert.throws(()=>execFileSync(astro,['build'],{
      env:{...env,IMAGINE_RELEASE_TARGET:target,
        IMAGINE_CATALOG_REQUIRE_SIGNED:'0'},
      stdio:'pipe',timeout:60000
    }),/Command failed|status/);
  }
  console.log('F37 protected Astro builds rejected omitted signing intent and editorial fallback.');

  // Com assinatura válida, um lote de publicação inesperado deve falhar.
  assert.throws(
    ()=>execFileSync(astro,['build'],{
      env:{...env,IMAGINE_CATALOG_EXPECTED_RELEASE_ID:'release_unapproved_ci'},
      stdio:'pipe',timeout:60000
    }),/Command failed|status/
  );
  envelope.signatureBase64=Buffer.alloc(64,4).toString('base64');
  writeFileSync(envelopePath,JSON.stringify(envelope));
  assert.throws(
    ()=>execFileSync(astro,['build'],{env,stdio:'pipe',timeout:60000}),
    /Command failed|status/
  );
  assert.throws(()=>execFileSync(process.execPath,
    ['scripts/build-protected-release.mjs'],{
      env,stdio:'pipe',timeout:120000
    }),/Command failed|status/);
  assert.equal(existsSync('dist'),false,
    'F37 invalid signing proof must leave no dist tree');
  assert.equal(existsSync('artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json'),
    false,'F37 invalid signing proof must leave no stale review artifact');
  console.log('F14 signed-build verification passed: approved release applied; wrong pin and altered signature rejected.');
} finally {
  // Se uma build com assinatura inválida truncou dist/, restaurar resultado público padrão.
  try{execFileSync(astro,['build'],{env:buildEnv,stdio:'pipe',timeout:60000});}
  finally{rmSync(root,{force:true,recursive:true});}
}
