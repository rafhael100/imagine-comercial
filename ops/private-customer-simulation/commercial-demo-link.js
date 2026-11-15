// Installed ONLY into the private development document root, never into public/dist.
'use strict';
(() => {
  if (location.hostname !== 'comercial-dev.imaginecomunica.com.br') return;
  const base = '/simulacao/compra/';
  function url(site, channels, tier) {
    const p = new URLSearchParams({site,channels:channels.sort().join(','),tier});
    return base + '?' + p.toString();
  }
  function choice(root) {
    return url(root.querySelector('[data-choice-site][aria-pressed="true"]')?.dataset.choiceSite || 'onepage',
      [...root.querySelectorAll('[data-choice-channel][aria-pressed="true"]')].map(b=>b.dataset.choiceChannel),
      root.querySelector('[data-choice-tier][aria-pressed="true"]')?.dataset.choiceTier || 'recommended');
  }
  // Capture the click before the public page's WhatsApp action. All prices are recalculated on the demo server.
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const a = event.target.closest('a');
    if (!a) return;
    if (a.matches('[data-choice-action]')) {
      if (a.getAttribute('aria-disabled')==='true') {event.preventDefault();return;}
      event.preventDefault(); location.assign(choice(a.closest('[data-choice-preview]'))); return;
    }
    if (a.matches('[data-purchase-intent]')) {event.preventDefault();location.assign(url(a.dataset.purchaseIntent==='ads'?'none':'onepage',[],'recommended'));return;}
    if (a.matches('[data-demo-start],[data-purchase-start]')) {event.preventDefault();location.assign(base);return;}
    if (a.matches('[data-quick-hire-action]')) {
      const raw = a.closest('[data-quick-hire]')?.dataset.quickHire || '';
      const site = raw.includes('landing') ? 'landing-pages' : raw.includes('onepage') ? 'onepage' : 'none';
      const channels = raw.includes('google') ? ['google_ads'] : raw.includes('meta') ? ['meta_ads'] : [];
      if (site!=='none'||channels.length) {event.preventDefault();location.assign(url(site,channels,'recommended'));}
    }
  }, true);
  for(const a of document.querySelectorAll('[data-quick-hire-action]')){
    const raw=a.closest('[data-quick-hire]')?.dataset.quickHire||'';
    if(['onepage','landing-pages','gestao-google-ads','gestao-meta-ads'].includes(raw)){
      a.removeAttribute('target');a.setAttribute('aria-label','Simular compra: '+raw);
      const site=raw==='onepage'?'onepage':raw==='landing-pages'?'landing-pages':'none';
      const channels=raw==='gestao-google-ads'?['google_ads']:raw==='gestao-meta-ads'?['meta_ads']:[];
      a.href=url(site,channels,'recommended');
    }
  }
  for (const root of document.querySelectorAll('[data-choice-preview]')) {
    const a=root.querySelector('[data-choice-action]');
    const label=root.dataset.locale==='en'?'Continue purchase simulation →':root.dataset.locale==='es'?'Continuar simulación de compra →':'Continuar simulação da compra →';
    if(a){a.textContent=label;a.removeAttribute('target');a.href=choice(root);}
    const note=root.querySelector('.choice-disclosure');
    if(note)note.textContent='Modo de demonstração privada: escolha, conta fictícia, pedido, pagamento simulado e briefing. Nenhum valor será cobrado e nenhum serviço real será ativado.';
  }
  const notice=document.querySelector('#quick-hire-notice');
  if(notice)notice.textContent='Demonstração privada: Onepage, Landing Page e anúncios abrem o fluxo de compra simulado com a escolha preservada. Serviços sob proposta seguem para atendimento. Nenhuma cobrança real.';
  for(const menu of document.querySelectorAll('header nav[aria-label="Navegação principal"], header nav.mobile-nav')){
    if(!menu.querySelector('.nav-cta,.nav-cta-mobile')){
      const portal=document.createElement('a');portal.href='https://portal-dev.imaginecomunica.com.br/_preview/portal/';
      portal.className=menu.classList.contains('mobile-nav')?'nav-cta-mobile':'nav-cta';
      portal.textContent='Portal do Cliente';menu.append(portal);
    }
  }
  const nav=document.querySelector('header nav')||document.querySelector('header');
  if(nav&&!document.querySelector('[data-demo-start],[data-purchase-start]')) {
    const a=document.createElement('a');a.href=base;a.dataset.demoStart='';a.textContent='Simular compra completa';
    a.className='cta';nav.append(a);
  }
})();
