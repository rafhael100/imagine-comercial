/* R37 PRIVATE DEMO ONLY: transfer a reviewed service enum to the existing
 * on-page quote simulator after an explicit visitor click. No cross-origin
 * messaging, storage, contact details, checkout or automatic submission. */
const host = document.querySelector('[data-faisca-private-inline]');
const button = host?.querySelector('[data-faisca-apply-choice]');
const status = host?.querySelector('[data-faisca-apply-status]');
const allowed = Object.freeze({ onepage: 'Site Onepage', 'landing-pages': 'Landing Page' });

function setStatus(text) {
  if (status) status.textContent = text;
}

if (host && button && status) {
  button.addEventListener('click', () => {
    try {
      const iframe = host.querySelector('iframe[data-faisca-inline-frame]');
      const root = iframe?.contentDocument?.querySelector('[data-faisca-root]');
      // A quote from a prior completed turn must not be transferred while
      // the visitor is submitting a new action or changing services.
      const log = root?.querySelector('[data-faisca-id="faisca-log"]');
      if (!log || log.getAttribute('aria-busy') !== 'false') {
        setStatus('Conclua a resposta atual do Faísca antes de usar o simulador.');
        return;
      }
      const value = root?.getAttribute('data-faisca-quote-site');
      const site = typeof value === 'string' &&
        Object.hasOwn(allowed, value) ? value : null;
      if (!site || !host.open) {
        setStatus('Conclua a qualificação do Faísca antes de levar a escolha ao simulador.');
        return;
      }
      const simulator = document.querySelector('#simular-compra[data-choice-preview]');
      const choice = simulator?.querySelector('[data-choice-site="' + site + '"]');
      if (!choice || choice.getAttribute('data-choice-site') !== site ||
          choice.tagName !== 'BUTTON' || choice.disabled) {
        setStatus('O simulador não está disponível nesta revisão. A escolha não foi enviada.');
        return;
      }
      choice.click();
      if (choice.getAttribute('aria-pressed') !== 'true') {
        setStatus('O simulador não confirmou a escolha. Nenhuma solicitação foi enviada.');
        return;
      }
      setStatus(allowed[site] +
        ' selecionado no simulador local. Nenhum contato, pedido, pagamento ou lead foi enviado.');
      choice.focus({ preventScroll: true });
      simulator.scrollIntoView({ block: 'start', behavior: 'auto' });
    } catch {
      setStatus('Não foi possível transferir esta escolha. Nenhuma solicitação foi enviada.');
    }
  });
}
