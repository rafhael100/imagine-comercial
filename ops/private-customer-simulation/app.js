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
    for (const group of choiceForm.querySelectorAll('[data-channel-prices]')) {
      for (const price of group.querySelectorAll('[data-price-channel]')) {
        price.hidden = !chosen.includes(price.dataset.priceChannel);
      }
      group.querySelector('[data-price-separator]').hidden = chosen.length !== 2;
      group.querySelector('[data-no-channel]').hidden = chosen.length !== 0;
    }
  };
  for (const input of channels) input.addEventListener('change', updateChannelPrices);
  window.addEventListener('pageshow', updateChannelPrices);
  updateChannelPrices();
}
