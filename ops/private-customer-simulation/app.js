// Enhancement only: the complete journey works without JavaScript.
'use strict';
for (const form of document.querySelectorAll('form')) {
  form.addEventListener('submit', () => {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement) active.setAttribute('aria-busy', 'true');
  });
}
