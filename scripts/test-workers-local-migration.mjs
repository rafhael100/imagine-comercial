/**
 * F16 — Teste de HTTP no runtime Cloudflare Workerd LOCAL, sem deploy.
 * Usa a versão pinada do Wrangler exclusivamente para este laboratório.
 * As regras _redirects são copiadas só para um diretório descartável.
 */
import {mkdtemp,cp,copyFile,writeFile,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {sitePages,toAbsoluteUrl} from '../src/data/services.mjs';
import {verifyIndexablePage,verifySitemapUrls,verifyRobotsSitemap} from '../src/lib/seo-output-contract.mjs';
import {createSecurityHeadersPreview,localHeaderProfile} from '../src/lib/security-headers-preview.mjs';

const root=await mkdtemp(join(tmpdir(),'imagine-workers-migration-'));
const configPath=join(root,'wrangler.json');
const port=8798;
let runner,logs='';
const base='http://127.0.0.1:'+port;
const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function probe(path) {
  return fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(3500)});
}
async function waitReady() {
  for(let attempt=0;attempt<90;attempt++){
    if(runner.exitCode!==null)throw Error('Wrangler closed: '+logs.slice(-2600));
    try {
      const response=await probe('/');
      if(response.status===200)return;
    }catch{}
    await nap(650);
  }
  throw Error('Wrangler local runtime not ready: '+logs.slice(-2600));
}
try{
  await lstat('dist/index.html');
  await cp(resolve('dist'),join(root,'dist'),{recursive:true});
  await copyFile('artifacts/migration-preview/REVIEW-ONLY-redirects.preview.txt',
    join(root,'dist/_redirects'));
  // F28: _headers exists ONLY inside disposable Workerd lab copy.
  await writeFile(join(root,'dist/_headers'),createSecurityHeadersPreview());
  await writeFile(configPath,JSON.stringify({
    name:'imagine-migration-local-only',
    compatibility_date:'2026-11-09',
    workers_dev:false,
    assets:{
      directory:'./dist/',
      not_found_handling:'404-page',
      html_handling:'auto-trailing-slash',
      run_worker_first:false
    }
  }));
  runner=spawn('npx',[
    '--yes','--package=wrangler@4.158.0','wrangler','dev','--local',
    '--config',configPath,'--ip','127.0.0.1','--port',String(port)
  ],{
    detached:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,WRANGLER_SEND_METRICS:'false',BROWSER:'none'}
  });
  runner.stdout.on('data',b=>{logs=(logs+b.toString()).slice(-12000)});
  runner.stderr.on('data',b=>{logs=(logs+b.toString()).slice(-12000)});
  await waitReady();

  const candidates=legacyUrls.filter(x=>x.status==='candidate');
  const held=legacyUrls.filter(x=>x.status==='hold');
  assert.equal(candidates.length,5);
  assert.equal(held.length,10);
  for(const {from:old,to:target} of candidates){
    const response=await probe(old);
    assert.equal(response.status,301,old+' must use real Worker 301');
    assert.equal(new URL(response.headers.get('location'),base).pathname,target,old+' target');
  }
  // F23: todo conteúdo indexável precisa funcionar no runtime de destino,
  // não apenas na simulação do Astro. Exigir metadados idênticos aos do build.
  for(const {path:publicPath} of sitePages){
    const response=await probe(publicPath);
    assert.equal(response.status,200,publicPath+' should respond HTTP 200 on Workerd');
    assert.match(response.headers.get('content-type')||'',/text\/html/i,
      publicPath+' must be served as HTML');
    for(const [name,value] of localHeaderProfile){
      assert.equal(response.headers.get(name),value,
        publicPath+' expected local-only security header '+name);
    }
    const html=await response.text();
    verifyIndexablePage(html,toAbsoluteUrl(publicPath));
  }

  const robots=await probe('/robots.txt');
  assert.equal(robots.status,200,'robots.txt must be accessible in Workerd');
  verifyRobotsSitemap(await robots.text(),'https://imaginecomunicacao.com.br/sitemap.xml');
  const sitemap=await probe('/sitemap.xml');
  assert.equal(sitemap.status,200,'sitemap.xml must be accessible in Workerd');
  verifySitemapUrls(await sitemap.text(),sitePages.map(x=>toAbsoluteUrl(x.path)));
  for(const blocked of [
    ...held.map(x=>x.from),'/uma-rota-f19-inexistente.html'
  ]){
    const response=await probe(blocked);
    assert.equal(response.status,404,blocked+' must not become a soft-404/redirect');
    const html=await response.text();
    assert.ok(/página não encontrada|página que você procura/i.test(html),
      blocked+' should render custom 404 page');
    assert.match(html,/<meta name="robots" content="noindex,nofollow"/,
      blocked+' should not be indexable');
    assert.doesNotMatch(html,/<link rel="canonical"/,
      blocked+' should not assert a canonical URL');
  }
  console.log('Cloudflare workerd LOCAL passed: '+candidates.length+' x 301, '+sitePages.length+' x 200, 2 SEO assets, '+(held.length+1)+' x 404; 4 reviewed headers on every public HTML; zero deployments.');
} finally{
  if(runner?.pid){
    try{process.kill(-runner.pid,'SIGTERM')}catch{}
  }
  await rm(root,{recursive:true,force:true});
}
