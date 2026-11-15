/**
 * F325: artifact-only, review-only buyer journey. Nothing enters src/pages or dist.
 * No customer data, persistence, network calls, URL redirects, checkout or payment.
 * Runs exclusively inside explicit GitHub Actions review job. Output: offline HTML.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {
 PREVIEW_CHANNELS,PREVIEW_SITES,previewCommercialSelection
} from '../../../src/lib/commercial-selection-preview.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true','F325 must run in disposable CI only');
assert.equal(process.env.IMAGINE_BUYER_JOURNEY_REVIEW,'1','F325 needs explicit offline review opt-in');
assert.equal(process.argv.length,2,'F325 accepts no path, URL, PII or checkout arguments');

const approved=Object.freeze({
 onepage:previewCommercialSelection({offer:'onepage'}),
 landing:previewCommercialSelection({offer:'landing-pages'}),
 performanceExample:previewCommercialSelection({
  offer:'performance',channels:{google_ads:150000,meta_ads:100000}
 }),
 channelPolicy:PREVIEW_CHANNELS
});
const payload=JSON.stringify(approved).replace(/</g,'\\u003c');
const html=`<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>Imagine | Prévia privada da contratação F325</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#171b19;background:#faf8f5}
*{box-sizing:border-box}body{margin:0;line-height:1.5}main{width:min(1090px,calc(100% - 32px));margin:auto}
header{background:#171b19;color:#fff;padding:21px max(16px,calc((100vw - 1090px)/2))}
header strong{font-size:1.25rem}header b{color:#f9941d}header span{display:block;color:#e1e1e1;font-size:.79rem}
.hero{padding:43px 0 20px}.eyebrow{text-transform:uppercase;color:#96500b;letter-spacing:.12em;font-size:.75rem;font-weight:900}
h1{max-width:750px;font-size:clamp(2.15rem,4.5vw,3.7rem);line-height:1.11;letter-spacing:-.055em;margin:10px 0}
.hero p{color:#5d544b;max-width:750px}
.steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0;margin:18px 0 28px;list-style:none}
.steps li{padding:12px;background:#fff;border:1px solid #e4ded6;border-radius:11px;font-size:.83rem;font-weight:750;min-width:0}
.steps li span{color:#96500b;margin-right:6px}
.panels{display:grid;grid-template-columns:1.35fr .85fr;gap:18px;align-items:start;margin:0 0 70px}
.panel{background:#fff;border:1px solid #e6ddd3;border-radius:18px;padding:23px;box-shadow:0 12px 30px #211b1109;min-width:0}
.panel h2{font-size:1.4rem;letter-spacing:-.035em;margin:0 0 5px}.hint{color:#625a51;font-size:.87rem;margin:0 0 18px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.choose{display:flex;flex-direction:column;gap:5px;text-align:left;background:#fffaf4;border:2px solid #e8dbc9;border-radius:14px;padding:14px;cursor:pointer;min-height:132px}
.choose[aria-pressed=true]{border-color:#a95300;background:#fff1df;box-shadow:inset 0 0 0 1px #a95300}
.choose b{font-size:1.03rem}.choose small{color:#5d544b}.choose em{font-style:normal;color:#95500b;font-weight:750;font-size:.82rem;margin-top:auto}
.fieldset{border:1px solid #eae1d7;border-radius:13px;padding:14px;margin-top:15px}.fieldset legend{font-weight:800}
.channel{display:flex;gap:9px;align-items:center;padding:10px 0}
.channel label{flex:1;font-weight:750}.channel input[type=checkbox]{width:20px;height:20px;accent-color:#c0650d}
.channel input[type=number]{width:117px;padding:9px;border:1px solid #a59b8e;border-radius:8px;font:inherit}
.small{font-size:.78rem;color:#665c50}.blocked{background:#f7f7f7;border-radius:12px;padding:12px;margin-top:18px;font-size:.82rem;color:#685b4c}
.summary{position:sticky;top:12px}.summary dl{display:grid;gap:12px;margin:18px 0}
.summary dl>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #eee5da;padding-bottom:9px}
.summary dt{color:#635b51;font-size:.83rem}.summary dd{margin:0;text-align:right;font-weight:900}
.main-amount{font-size:1.3rem;color:#914500}
button.primary{background:#f9941d;color:#171b19;border:0;padding:14px 18px;border-radius:10px;width:100%;font-size:1rem;font-weight:900;min-height:49px}
button:focus-visible,input:focus-visible{outline:3px solid #874000;outline-offset:3px}
button[disabled]{background:#e7e3dc;color:#675f54;cursor:not-allowed}
.status{font-size:.83rem;color:#5f5549}
.footer-note{border-top:1px solid #eee1d5;padding-top:14px;font-size:.78rem;color:#655b50}
[hidden]{display:none!important}
@media(max-width:820px){.panels{grid-template-columns:1fr}.summary{position:static}}
@media(max-width:560px){.cards{grid-template-columns:1fr}.steps{grid-template-columns:repeat(2,minmax(0,1fr))}.panel{padding:17px}}
</style></head>
<body>
<header><strong>imagine<b>✦</b></strong><span>Prévia privada de compra · dados fictícios · sem cadastro nem pagamento</span></header>
<main>
<section class="hero"><div class="eyebrow">Jornada de contratação · revisão F325</div>
<h1>Escolha o serviço. Personalize. Confira tudo antes de se cadastrar.</h1>
<p>Experiência navegável para avaliar o fluxo comercial. Esta página funciona sem internet e não envia nenhuma informação.</p></section>
<ol class="steps"><li><span>01</span>Escolha</li><li><span>02</span>Personalize</li><li><span>03</span>Confira</li><li><span>04</span>Cadastro no Portal</li></ol>
<div class="panels"><section class="panel" aria-labelledby="step1">
<h2 id="step1">Qual solução combina com seu negócio?</h2><p class="hint">Selecione para visualizar condições e personalizar sem informar dados pessoais.</p>
<div class="cards">
<button type="button" class="choose" data-offer="onepage" aria-pressed="true"><b>Onepage</b><small>Um site profissional em uma página.</small><em>Implantação R$ 990</em></button>
<button type="button" class="choose" data-offer="landing" aria-pressed="false"><b>Landing Page</b><small>Uma página focada na sua oferta.</small><em>Implantação R$ 1.290</em></button>
<button type="button" class="choose" data-offer="performance" aria-pressed="false"><b>Gestão de anúncios</b><small>Escolha Google Ads e/ou Meta Ads.</small><em>Ativação R$ 490/canal</em></button>
</div>
<fieldset id="channels" class="fieldset" hidden>
<legend>Personalize os canais e a mídia mensal</legend>
<div class="channel"><input type="checkbox" id="google" checked><label for="google">Google Ads <span class="small">(mín. R$ 1.000)</span></label><input id="google-amount" type="number" min="1000" max="1000000" step="10" value="1500" aria-label="Mídia mensal Google em reais"></div>
<div class="channel"><input type="checkbox" id="meta" checked><label for="meta">Meta Ads <span class="small">(mín. R$ 700)</span></label><input id="meta-amount" type="number" min="700" max="1000000" step="10" value="1000" aria-label="Mídia mensal Meta em reais"></div>
<p class="small">Mídia paga diretamente às plataformas. Facebook e Instagram são um único canal Meta. A gestão mensal é estimada agora, mas depende do gasto real verificado após mês civil completo.</p>
</fieldset>
<p class="blocked">Site completo e assinatura: proposta personalizada. ChatGPT Ads: elegibilidade em estudo, sem checkout habilitado.</p>
</section>
<aside class="panel summary" aria-labelledby="step3">
<div class="eyebrow">03 · Confira</div><h2 id="step3">Resumo da sua escolha</h2>
<p class="hint" id="summary-caption">Valores informativos, sujeitos à confirmação no Portal.</p>
<p id="error" role="alert" hidden></p>
<dl>
<div><dt>Implantação / ativação única</dt><dd class="main-amount" id="setup">—</dd></div>
<div><dt>Mensalidade ou gestão estimada</dt><dd id="monthly">—</dd></div>
<div><dt>Mídia mensal paga à plataforma</dt><dd id="media">—</dd></div>
<div><dt>Condições</dt><dd id="terms">—</dd></div>
</dl>
<button class="primary" type="button" disabled aria-describedby="lock-note">Cadastro e contratação após homologação</button>
<p class="status" id="lock-note">Nenhum cadastro, contrato, pagamento ou envio de dados está disponível nesta prévia.</p>
<p class="footer-note">A autoridade sobre preços, aceite, autenticação, tributação e pagamento é exclusiva do Imagine Portal homologado. Este arquivo não tem conexão com a VPS ou gateway.</p>
</aside></div></main>
<script id="approved-prices" type="application/json">${payload}</script>
<script>
'use strict';
const P=JSON.parse(document.getElementById('approved-prices').textContent);
let offer='onepage';
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const byId=id=>document.getElementById(id);
function show(){
 const ads=offer==='performance';
 byId('channels').hidden=!ads;
 document.querySelectorAll('[data-offer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.offer===offer)));
 const err=byId('error');err.hidden=true;err.textContent='';
 let setup,monthly,media,terms;
 if(!ads){
  const q=offer==='onepage'?P.onepage:P.landing;
  setup=money(q.setupCents);monthly=money(q.monthlyCents)+'/mês';media='Não se aplica';
  terms='3× '+money(q.installmentCents)+' · 1ª mensalidade em D+90 da contratação';
 }else{
  const rows=[['google','google_ads'],['meta','meta_ads']].filter(([id])=>byId(id).checked);
  if(rows.length===0){err.hidden=false;err.textContent='Selecione ao menos um canal.';return;}
  let activation=0,management=0,spend=0;
  for(const [id,code] of rows){
   const value=byId(id+'-amount').value;
   if(!/^[0-9]{1,7}$/.test(value)){err.hidden=false;err.textContent='Informe um valor inteiro válido em reais.';return;}
   const cents=Number(value)*100;
   if(cents<P.channelPolicy[code].minimumMediaCents||cents>100000000){
    err.hidden=false;err.textContent='Confira o mínimo e o limite de mídia de cada canal.';return;
   }
   spend+=cents;activation+=P.channelPolicy[code].activationCents;
   management+=Math.max(17000,Math.floor((cents*20+50)/100));
  }
  setup=money(activation);monthly=money(management)+'/mês*';
  media=money(spend)+'/mês';terms='Gestão pós-paga: 20% da mídia efetiva, mín. R$ 170/canal';
 }
 byId('setup').textContent=setup;byId('monthly').textContent=monthly;
 byId('media').textContent=media;byId('terms').textContent=terms;
}
document.querySelectorAll('[data-offer]').forEach(b=>b.addEventListener('click',()=>{offer=b.dataset.offer;show();}));
for(const id of ['google','meta','google-amount','meta-amount']){
 byId(id).addEventListener('input',show);
}
show();
</script>
</body></html>`;
const target=resolve('artifacts/review-f325-private-buyer-journey.html');
mkdirSync(dirname(target),{recursive:true});
writeFileSync(target,html,'utf8');
assert.ok(html.includes('noindex,nofollow,noarchive'));
assert.ok(!html.includes('<form')&&!html.includes('fetch(')&&!html.includes('XMLHttpRequest'));
assert.ok(!html.includes('localStorage')&&!html.includes('sessionStorage'));
assert.ok(!html.includes('https://')&&!html.includes('http://'));
console.log('F325 offline review-only HTML written; no public dist, data processing or payment');
