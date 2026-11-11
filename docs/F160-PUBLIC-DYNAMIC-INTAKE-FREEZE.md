# F160 — Freeze de formulários dinâmicos no pacote público

A política F76 já impedia `<form>`, `<input>`, `<textarea>`, `fetch`, cookies e `localStorage` no HTML Astro, mas código JavaScript poderia criar formulários depois do carregamento por `document.createElement`, `FormData`, `requestSubmit`, `innerHTML` ou `insertAdjacentHTML`.

F160 amplia a verificação pós-build para proibir criação dinâmica de campos de captura, submissões por API de formulário, HTML não auditável injetado no DOM, IndexedDB e workers/canais de segundo plano em **todos os assets públicos JS e HTML**. A verificação não pode ser desligada por ambiente. Mantém seletores dos catálogos, links `/contato/#serviço`, criação segura de âncoras/itens de lista, e cópia explícita com `navigator.clipboard.writeText`.

Os testes adversariais impedem regressões e os builds Astro/SEO/Chromium verificam que os scripts reais permanecem funcionais. Esta política é temporária até o serviço de captação ser homologado; não é substituto de CSP, AppSec ou revisão de código. Nenhum dado pessoal é usado; nenhum endpoint é ativado.
