// Enhancement only: the complete journey works without JavaScript.
'use strict';
for (const form of document.querySelectorAll('form')) {
  form.addEventListener('submit', () => {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement) active.setAttribute('aria-busy', 'true');
  });
}

const choiceForm = document.querySelector('.choice-form');
if (choiceForm) {
  const channels = [...choiceForm.querySelectorAll('input[name="channels[]"]')];
  const updateChannelPrices = () => {
    const chosen = channels.filter(input => input.checked).map(input => input.value);
    choiceForm.querySelector('[data-investment-section]').hidden = chosen.length === 0;
    for (const group of choiceForm.querySelectorAll('[data-channel-prices]')) {
      const values=group.dataset.tier==='minimum'?['Google R$ 1.000/mês','Meta R$ 700/mês','ChatGPT R$ 1.200 / 30 dias (R$ 40/dia)']:['Google R$ 1.500/mês','Meta R$ 1.000/mês','ChatGPT R$ 1.800 / 30 dias'];
      group.textContent=['google_ads','meta_ads','chatgpt_ads'].flatMap((ch,i)=>chosen.includes(ch)?[values[i]]:[]).join(' · ');
    }
  };
  for (const input of channels) input.addEventListener('change', updateChannelPrices);
  window.addEventListener('pageshow', updateChannelPrices);
  updateChannelPrices();
}
