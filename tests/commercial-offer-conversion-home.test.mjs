import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const showcase=readFileSync(new URL('../src/components/QuickServiceRequest.astro',import.meta.url),'utf8');
const international=readFileSync(new URL('../src/components/InternationalPage.astro',import.meta.url),'utf8');
const intlSales=readFileSync(new URL('../src/components/InternationalSalesHome.astro',import.meta.url),'utf8');
const artwork=readFileSync(new URL('../src/components/OfferArtwork.astro',import.meta.url),'utf8');

test('F321 leads with benefit and internal product choice, without requiring signup',()=>{
 assert.match(home,/Seu negócio mais bonito/);
 assert.match(home,/href="#simular-compra" data-purchase-intent="site">Quero um site/);
 assert.match(home,/Sem cadastro para explorar/);
 assert.ok(home.indexOf('href="#simular-compra"')<home.indexOf('href="/contato/"'));
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
 assert.match(showcase,/O cadastro fica para o final/);
 assert.match(showcase,/Nenhum cadastro, contrato ou pagamento real/);
 assert.doesNotMatch(showcase,/<form\b|<input\b|<textarea\b|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie/);
});

test('F323 home EN/ES uses the same four illustrative offers and concise funnel as PT',()=>{
 assert.match(international,/InternationalSalesHome locale=\{locale\}/);
 assert.match(intlSales,/Make your business stand out/);
 assert.match(intlSales,/Haz que tu negocio destaque/);
 assert.match(intlSales,/I want a website/);
 assert.match(intlSales,/Quiero un sitio web/);
 assert.match(intlSales,/href="#intl-solutions"/);
 assert.match(intlSales,/href="#intl-ads"/);
 assert.match(intlSales,/featured=\['onepage','landing-pages','gestao-chatgpt-ads','gestao-google-ads'\]/);
 assert.match(intlSales,/additional=\['gestao-meta-ads','sites-por-assinatura','criacao-de-sites'\]/);
 assert.match(intlSales,/<OfferArtwork slug=\{slug\}\/>/);
 assert.match(artwork,/art-gestao-google-ads/);
 assert.match(intlSales,/Review|Revisa/);
 assert.match(intlSales,/BRL 170/);
 assert.match(intlSales,/R\$ 170/);
 assert.match(intlSales,/BRL 490/);
 assert.match(intlSales,/R\$ 490/);
 assert.match(intlSales,/first monthly payment 90 days/);
 assert.match(intlSales,/primera mensualidad 90 días/);
 assert.doesNotMatch(intlSales,/<(?:form|input|textarea)\b|\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/);
});

test('F323 public international service selection uses opt-in contact, no checkout',()=>{
 assert.match(intlSales,/localizedSalesWhatsAppUrl\(locale,slug\)/);
 assert.match(intlSales,/target="_blank" rel="noopener noreferrer"/);
 assert.match(intlSales,/No se envía automáticamente/);
 assert.match(intlSales,/Nothing is sent automatically/);
 assert.match(intlSales,/no public checkout or payment/);
 assert.doesNotMatch(intlSales,/portal-dev|asaas|paymentEnabled|cart_checkout|customer_id/);
});
