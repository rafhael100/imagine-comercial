/**
 * Lighthouse sobre Astro preview local. Não mede Core Web Vitals de campo.
 * Relatórios em artifacts/lighthouse, sem publicação ou envio para serviço externo.
 */
import {mkdir,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const port=4351;
const origin='http://127.0.0.1:'+port;
const output='artifacts/lighthouse';
const paths=[['home','/'],['landing-pages','/servicos/landing-pages/']];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let server;
function invoke(program,args,{env=process.env,timeoutMs=180000}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(program,args,{env,stdio:['ignore','pipe','pipe']});
    let log='';
    child.stdout.on('data',b=>{log=(log+b.toString()).slice(-8000)});
    child.stderr.on('data',b=>{log=(log+b.toString()).slice(-8000)});
    const timeout=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Lighthouse timed out: '+log))},timeoutMs);
    child.on('error',e=>{clearTimeout(timeout);reject(e)});
    child.on('close',code=>{clearTimeout(timeout);
      if(code!==0)reject(Error(program+' exited '+code+': '+log));
      else resolve(log);
    });
  });
}
async function ready() {
  for(let i=0;i<70;i++) {
    if(server.exitCode!==null)throw Error('Astro preview stopped unexpectedly');
    try {
      const response=await fetch(origin+'/',{signal:AbortSignal.timeout(1000)});
      if(response.status===200)return;
    }catch{}
    await sleep(400);
  }
  throw Error('Astro preview never served homepage');
}
try {
  await mkdir(output,{recursive:true});
  server=spawn('node_modules/.bin/astro',['preview','--host','127.0.0.1','--port',String(port)],{
    stdio:['ignore','pipe','pipe'],
    env:{...process.env,IMAGINE_CATALOG_ENVELOPE_FILE:'',IMAGINE_CATALOG_PUBLIC_KEY_FILE:'',
      IMAGINE_CATALOG_TRUSTED_KEY_ID:'',IMAGINE_CATALOG_EXPECTED_RELEASE_ID:'',
      IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:''}
  });
  await ready();
  const metrics=[];
  for(const [label,path] of paths) {
    const json=output+'/'+label+'-mobile.json';
    await invoke('npx',[
      '--yes','--package=lighthouse@13.6.0','lighthouse',origin+path,
      '--only-categories=performance,accessibility,seo',
      '--output=json','--output-path='+json,
      '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
      '--quiet'
    ],{env:{...process.env,CHROME_PATH:chromium.executablePath()}});
    const report=JSON.parse(await readFile(json,'utf8'));
    const scores=Object.fromEntries(
      ['performance','accessibility','seo'].map(k=>[k,Math.round(report.categories[k].score*100)])
    );
    metrics.push({
      page:label,path,scores,
      lcpMs:report.audits['largest-contentful-paint']?.numericValue??null,
      cls:report.audits['cumulative-layout-shift']?.numericValue??null,
      tbtMs:report.audits['total-blocking-time']?.numericValue??null
    });
    assert.ok(scores.seo>=90,label+': Lighthouse SEO below 90: '+JSON.stringify(scores));
    assert.ok(scores.accessibility>=90,label+': Lighthouse accessibility below 90: '+JSON.stringify(scores));
    // Performance is reported as an observed lab baseline, not a brittle CI score gate.
  }
  console.log('Lighthouse LOCAL mobile baseline (not field data):',JSON.stringify(metrics));
} finally {
  if(server?.pid)server.kill('SIGTERM');
}
