import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const showcase=readFileSync(new URL('../src/components/QuickServiceRequest.astro',import.meta.url),'utf8');
const international=readFileSync(new URL('../src/components/InternationalPage.astro',import.meta.url),'utf8');

test('F321 leads with benefit and internal product choice, without requiring signup',()=>{
 assert.match(home,/Seu negócio merece uma presença digital que desperte interesse/);
 assert.match(home,/href="#solucoes">Escolher minha solução/);
 assert.match(home,/Explore sem cadastro/);
 assert.ok(home.indexOf('href="#solucoes"')<home.indexOf('href="/contato/"'));
 assert.doesNotMatch(home,/<(?:form|input|textarea)\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
});

test('F321 each catalog entry belongs to exactly one reviewed sales group',()=>{
 const site=['onepage','landing-pages','criacao-de-sites','sites-por-assinatura'];
 const ads=['gestao-google-ads','gestao-meta-ads','gestao-chatgpt-ads'];
 assert.equal(services.length,7);
 assert.deepEqual(new Set([...site,...ads]).size,7);
 for(const service of services){
  assert.ok([...site,...ads].includes(service.slug),service.slug);
  assert.ok(showcase.includes("'"+service.slug+"':{"),service.slug+' has commercial copy');
 }
 assert.match(showcase,/id:'sites-paginas'/);
 assert.match(showcase,/id:'anuncios-performance'/);
 assert.match(showcase,/data-quick-hire=\{service\.slug\}/);
 assert.match(showcase,/data-quick-hire-action/);
 assert.match(showcase,/aria-describedby="quick-hire-notice"/);
});

test('F321 clearly separates media, one-time setup, postpaid management, and ChatGPT eligibility',()=>{
 assert.match(showcase,/R\$ 490/);
 assert.match(showcase,/20% da mídia efetiva/);
 assert.match(showcase,/mínimo R\$ 170\/mês/);
 assert.match(showcase,/mídia é paga diretamente/);
 assert.match(showcase,/Canal não habilitado para checkout/);
 assert.match(showcase,/Os dados necessários ao fechamento|Dados e pagamento somente depois/);
 assert.match(showcase,/Nenhum cadastro, contrato ou pagamento real/);
 assert.doesNotMatch(showcase,/<form\b|<input\b|<textarea\b|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie/);
});

test('F321 international front pages keep the purchase-first sequence in both languages',()=>{
 assert.match(international,/Find my solution/);
 assert.match(international,/Encontrar mi solución/);
 assert.match(international,/Review scope and pricing/);
 assert.match(international,/Revisar alcance y precios/);
 assert.match(international,/Not available|not available for checkout|no disponible para contratar/i);
 assert.match(international,/BRL 170/);
 assert.match(international,/R\$ 170/);
 assert.match(international,/href="#intl-solutions"/);
 assert.match(international,/href="#intl-sites"/);
 assert.match(international,/href="#intl-ads"/);
});
