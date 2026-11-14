# F169 — Link compartilhável de briefing curado no contato público

## Nova funcionalidade real para o visitante

Na página `/contato/`, o visitante pode selecionar um serviço, objetivo, momento e prioridade dos **catálogos públicos existentes** e clicar em **Copiar link deste briefing**. O navegador produz um endereço com fragmento (ex.: `/contato/#briefing:onepage:melhorar-site:iniciando:contatos`) que preseleciona as quatro opções ao ser aberto no futuro. Isso facilita encaminhar o contexto a um colega ou voltar à seleção sem preencher tudo novamente.

A funcionalidade não usa nome, telefone, e-mail, mensagem livre, cookies, armazenamento, `fetch`, analítica ou qualquer integração CRM. A URL copiada é construída de `window.location.origin + '/contato/'` e **não contém a query string atual**, que poderia incluir parâmetros desnecessários. O fragmento inclui apenas os valores permitidos e nunca é enviado ao servidor HTTP na navegação. A cópia é acionada por clique e só aparece em navegadores com Clipboard API; no-JS mantém WhatsApp e e-mail sem alterações.

O parser `src/data/curated-briefing-fragment.mjs` valida de modo estrito os **560 estados** públicos, com `~` representando opção vazia e `:` separando os campos. Fragments malformados, percent-encoding alternativo, `@email`, token extra ou código desconhecido retornam `null` e restauram escolhas vazias. Os links legados `/contato/#onepage` e demais seis slugs continuam funcionando com a seleção antiga de serviço único.

O Playwright testa clique real de cópia, texto exato no clipboard, abertura do link compartilhado, reconstrução das quatro seleções, mensagem WhatsApp idêntica, fragmento injetado recusado, ausência de navegação automática e botão oculto quando JavaScript está desligado. Os testes Node percorrem todos os 560 estados.

**Sem preços inventados, orçamento automatizado, envio de contatos ou persistência.** O formulário P0, Portal/CRM, consentimento e liberação de produção permanecem dependentes de homologação independente. Esta PR só altera desenvolvimento.
