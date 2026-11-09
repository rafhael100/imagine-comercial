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
