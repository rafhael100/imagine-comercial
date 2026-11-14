/**
 * F318: create a self-contained PRIVATE staging REVIEW kit from the exact
 * Astro dist tree and reviewed Nginx/Compose source. Does not run Docker,
 * access Leaseweb, read secret env vars, contact any host, or deploy.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {sitePages} from '../src/data/services.mjs';
import {readProtectedDist} from '../src/lib/read-protected-dist.mjs';
import {reviewStagingBuildIntegrity} from '../src/lib/staging-build-integrity.mjs';

const m=JSON.parse(readFileSync(
  'artifacts/release-review/REVIEW-ONLY-static-build-sha256.json','utf8'));
assert.equal(m.schema,'imagine.comercial.release-review.v1');
assert.equal(m.mode,'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY');
assert.equal(m.origin,'https://imaginecomunicacao.com.br/');
assert.equal(m.htmlPages,sitePages.length);
assert.equal(m.files.length,m.fileCount);
assert.equal(m.treeSha256.length,64);
assert.equal(reviewStagingBuildIntegrity({
  root:'dist',expectedTreeSha256:m.treeSha256
}).exactTreeBytesVerified,true);
const actual=readProtectedDist('dist');
assert.equal(actual.length,m.fileCount);
const compiled=new Map(actual.map(x=>[x.path,x.bytes]));
for(const file of m.files){
  const data=compiled.get(file.path);
  assert.ok(data,'F318: unlisted source file');
  assert.equal(data.length,file.size);
  assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);
}
const conf=readFileSync('ops/staging/compose.yaml','utf8');
const nginx=readFileSync('ops/staging/nginx.conf','utf8');
assert.ok(conf.includes('127.0.0.1:4321:8080'));
assert.ok(conf.includes('IMAGINE_STAGING_NGINX_IMAGE'));
assert.ok(conf.includes('IMAGINE_STAGING_HTPASSWD_PATH'));
assert.ok(conf.includes('read_only: true'));
assert.ok(conf.includes('no-new-privileges:true'));
assert.ok(nginx.includes('auth_basic_user_file /etc/nginx/auth/.htpasswd;'));
assert.ok(nginx.includes('X-Robots-Tag "noindex, nofollow, noarchive"'));
assert.ok(nginx.includes('limit_except GET HEAD { deny all; }'));
const kit='artifacts/private-staging-review-kit';
rmSync(kit,{recursive:true,force:true});
mkdirSync(join(kit,'ops/staging'),{recursive:true});
cpSync('dist',join(kit,'dist'),{recursive:true,errorOnExist:true});
cpSync('ops/staging/compose.yaml',join(kit,'ops/staging/compose.yaml'));
cpSync('ops/staging/nginx.conf',join(kit,'ops/staging/nginx.conf'));
writeFileSync(join(kit,'REVIEW-ONLY-static-build-sha256.json'),
  JSON.stringify(m,null,2)+'\n');
const configHashes={
 composeSha256:createHash('sha256').update(conf).digest('hex'),
 nginxSha256:createHash('sha256').update(nginx).digest('hex')
};
const metadata={
 schema:'imagine.comercial.private-staging-review-kit.v1',
 status:'NO_DEPLOY_REVIEW_KIT_ONLY',
 sourceCommit:process.env.GITHUB_SHA&&/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA)?
   process.env.GITHUB_SHA:null,
 staticTreeSha256:m.treeSha256,
 publicHtmlPages:m.htmlPages,
 staticFileCount:m.fileCount,
 expectedStaticBytes:m.totalBytes,
 ...configHashes,
 loopbackOnly:true,
 noindexOnStagingRequired:true,
 basicAuthBcryptOperatorFileRequired:true,
 imageDigestApprovalRequired:true,
 independentTreeHashTrustRequired:true,
 sourceConfigVerifiedInCIOnly:true,
 liveDockerConfigVerified:false,
 liveLeasewebAccessVerified:false,
 realLegacyContactDeliveryVerified:false,
 productionRedirectsAuthorized:0,
 releaseAuthorized:false,
 deployPerformed:false,
 noCredentialsIncluded:true
};
writeFileSync(join(kit,'REVIEW-ONLY-kit-metadata.json'),
  JSON.stringify(metadata,null,2)+'\n');
const verifier=`import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative,dirname,sep,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
try{
 const m=JSON.parse(readFileSync(join(root,'REVIEW-ONLY-static-build-sha256.json'),'utf8'));
 const kit=JSON.parse(readFileSync(join(root,'REVIEW-ONLY-kit-metadata.json'),'utf8'));
 if(kit.status!=='NO_DEPLOY_REVIEW_KIT_ONLY'||kit.releaseAuthorized!==false||
    kit.deployPerformed!==false||m.fileCount!==kit.staticFileCount||
    m.htmlPages!==kit.publicHtmlPages||m.treeSha256!==kit.staticTreeSha256||
    !Array.isArray(m.files)||m.files.length!==m.fileCount)
   throw Error('invalid review kit');
 const listed=new Set(),actual=[];
 function walk(dir){
  for(const item of readdirSync(dir,{withFileTypes:true})){
   const path=join(dir,item.name),stat=lstatSync(path);
   if(stat.isSymbolicLink())throw Error('symlink');
   if(stat.isDirectory())walk(path);
   else if(stat.isFile())actual.push(relative(join(root,'dist'),path).replaceAll('\\','/'));
   else throw Error('unreviewed file');
  }
 }
 walk(join(root,'dist'));
 let total=0;
 for(const file of m.files){
  if(typeof file.path!=='string'||!(/^[a-zA-Z0-9_./-]+$/.test(file.path))||
    file.path.includes('..')||file.path.startsWith('/')||listed.has(file.path))
    throw Error('unreviewed path');
  listed.add(file.path);
  const full=resolve(root,'dist',file.path);
  if(!full.startsWith(resolve(root,'dist')+sep))throw Error('escape');
  const bytes=readFileSync(full);
  if(bytes.length!==file.size||
    createHash('sha256').update(bytes).digest('hex')!==file.sha256)
    throw Error('altered compiled bytes');
  total+=bytes.length;
 }
 if(actual.length!==listed.size||actual.some(x=>!listed.has(x))||
    total!==m.totalBytes)throw Error('extra files');
 for(const [name,hash] of [
  ['compose.yaml',kit.composeSha256],
  ['nginx.conf',kit.nginxSha256]]){
  const bytes=readFileSync(join(root,'ops','staging',name));
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('modified staging policy');
 }
 console.log('PASS: '+m.fileCount+' static files and source config SHA-256 verified.');
 console.log('REVIEW ONLY. This verifies no origin, identity, TLS or deployment.');
}catch{
 console.error('HOLD: private staging kit cannot be independently verified.');
 process.exitCode=2;
}
`;
writeFileSync(join(kit,'verify-kit.mjs'),verifier);
const readme=`# Imagine Comercial — kit de homologação privada (F318)

**REVIEW ONLY / NO-MERGE / NO-DEPLOY / NO-CHECKOUT / NO-LEADS.**

Este pacote contém o **build Astro de ${m.htmlPages} páginas**, manifesto por
arquivo, configurações de Nginx e Docker Compose **apenas para revisão**
e um verificador offline. Nenhum segredo, certificado, arquivo htpasswd
ou configuração de gateway está incluído.

```bash
node verify-kit.mjs
```

O comando acima compara todos os arquivos do site aos SHA-256 informados
e as configurações Nginx/Compose aos hashes da própria revisão; não
autentica a origem independente desses hashes nem faz deploy.

**Para um operador autorizado na VPS Leaseweb:**
- Confirmar a integridade por um SHA obtido em canal independente.
- Validar regras F253, F254, F256, F257, F258 e a sequência oficial
  em `ops/staging/README.md` **no checkout completo e revisado do GitHub**.
  Os arquivos isolados deste kit não substituem essas ferramentas.
- Escolher imagem Nginx unprivileged **fixada por digest real** após
  revisão de segurança, sem usar `latest`.
- Criar arquivo bcrypt `.htpasswd` privado para o usuário `reviewer`
  fora do repositório; jamais enviá-lo ao ChatGPT, GitHub ou artifact.
- Manter a porta **exclusivamente em 127.0.0.1:4321**; acesso remoto
  apenas por túnel SSH autorizado, proteção adicional e `noindex`.
- Testar respostas 401 anônimas, HTML e ativos 200 autenticados,
  404 do legado na prévia isolada, métodos não permitidos, hashes e
  cadeia de seis diagnósticos de staging. Não encaminhar leads reais.
- Exigir ainda backup/restauração do site original, formulários antigos
  operacionais, 27 URLs legadas, GSC, termos e política de privacidade,
  DNS/TLS e rollback antes da **aprovação separada de produção**.

**Não executar `docker compose up` como consequência deste pacote.**
A decisão de iniciar o staging privado exige operador, autenticação,
segredos e revisão de infraestrutura. Este kit não contém script de
publicação, Worker de borda, DNS, 301 ou endpoint de cobrança.
`;
writeFileSync(join(kit,'LEIA-ME-STAGING.md'),readme);
assert.equal(reviewStagingBuildIntegrity({
  root:join(kit,'dist'),expectedTreeSha256:m.treeSha256
}).exactTreeBytesVerified,true);
console.log('F318 PASS: verified private staging REVIEW kit prepared for '+m.htmlPages+
  ' pages, no credentials, no deploy.');
