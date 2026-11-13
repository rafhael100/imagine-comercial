# F151 — Copiar mensagem curada do briefing

A tela de contato oferece uma terceira ação local: **Copiar mensagem**. O botão só aparece quando a API nativa de área de transferência está disponível; sem JavaScript, o WhatsApp e o e-mail preexistentes continuam acessíveis.

A mensagem é exclusivamente o resultado de `composeCuratedBriefingLinks`, com códigos públicos já revisados de serviço, objetivo, momento e prioridade. A gravação ocorre **somente** após clicar no botão; não existe `POST`, formulário, cookies, armazenamento do navegador, tracking ou qualquer contato automático com Portal/CRM. Não são solicitados nomes, telefones ou textos livres.

Uma região `role=status/aria-live=polite` confirma a cópia, informa falha ou é limpa quando a seleção muda. O teste Chromium concede permissão apenas ao clipboard local do contexto de QA, lê de volta o texto exato e verifica que nada é transmitido. A mesma suíte confirma que o botão não aparece com scripts desabilitados.

**Gate:** versão de desenvolvimento; não libera recebimento de orçamentos, paridade F70, Portal/CRM operacional, DNS, redirects ou deploy.
