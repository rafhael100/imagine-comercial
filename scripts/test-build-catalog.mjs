/**
 * Teste integrativo: compilar Astro com snapshot público assinado fictício,
 * comprovar atualização do HTML, rejeitar assinatura falsificada e restaurar build normal.
 * Chaves de teste são geradas em memória; nenhum segredo entra no repositório.
 */
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

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
  IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:createHash('sha256').update(bytes).digest('hex')};
const buildEnv={...process.env};
delete buildEnv.IMAGINE_CATALOG_ENVELOPE_FILE;
delete buildEnv.IMAGINE_CATALOG_PUBLIC_KEY_FILE;
delete buildEnv.IMAGINE_CATALOG_TRUSTED_KEY_ID;
delete buildEnv.IMAGINE_CATALOG_EXPECTED_RELEASE_ID;
delete buildEnv.IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256;
const astro='node_modules/.bin/astro';
try {
  execFileSync(astro,['build'],{env,stdio:'pipe',timeout:60000});
  const built=readFileSync('dist/servicos/landing-pages/index.html','utf8');
  assert.ok(built.includes(label),'Build must use signed metadata title');
  assert.ok(built.includes(description),'Build must use signed public intro');
  assert.ok(!built.includes('portal_test_ci_01'),'Public HTML must not expose signing key ID');

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
  console.log('F14 signed-build verification passed: approved release applied; wrong pin and altered signature rejected.');
} finally {
  // Se uma build com assinatura inválida truncou dist/, restaurar resultado público padrão.
  try{execFileSync(astro,['build'],{env:buildEnv,stdio:'pipe',timeout:60000});}
  finally{rmSync(root,{force:true,recursive:true});}
}
