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

  for(const [old,target] of [
    ['/fale-conosco.html','/contato/'],
    ['/agencia-imagine-comunicacao-digital.html','/sobre/']
  ]){
    const response=await probe(old);
    assert.equal(response.status,301,old+' must use real Worker 301');
    assert.equal(new URL(response.headers.get('location'),base).pathname,target,old+' target');
  }
  const home=await probe('/');
  assert.equal(home.status,200,'Public home should remain accessible');
  const contact=await probe('/contato/');
  assert.equal(contact.status,200,'Target page should be accessible');
  for(const blocked of [
    '/clientes.html','/en-us/','/en-us/termos-de-uso.html',
    '/uma-rota-f16-inexistente.html'
  ]){
    const response=await probe(blocked);
    assert.equal(response.status,404,blocked+' must not become a soft-404/redirect');
    const html=await response.text();
    assert.ok(/página não encontrada|página que você procura/i.test(html),
      blocked+' should render custom 404 page');
  }
  console.log('Cloudflare workerd LOCAL passed: 2 x 301, 2 x 200, 4 x 404; zero deployments.');
} finally{
  if(runner?.pid){
    try{process.kill(-runner.pid,'SIGTERM')}catch{}
  }
  await rm(root,{recursive:true,force:true});
}
