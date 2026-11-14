# F62 — Contato com navegação por serviço consistente e acessível

A página Contato já aceitava `/contato/#slug`, mas apenas na entrada inicial. Se o fragmento mudasse no histórico ou em outra interação da mesma aba, o seletor e os links de WhatsApp/e-mail poderiam ficar desencontrados.

A F62 corrige esse fluxo:

- Na entrada inicial, `hashchange` e `popstate`, o fragmento é aceito **somente** se corresponder ao valor de uma opção do catálogo público de serviços. Qualquer valor desconhecido restaura a orientação genérica, sem refletir conteúdo arbitrário.
- Alterar o seletor atualiza o fragmento com `history.replaceState`, sem criar uma entrada para cada clique no histórico, sem redirecionar nem enviar dados.
- O texto de ajuda usa `role="status"` e `aria-live="polite"` e o seletor usa `aria-describedby`, facilitando a percepção da escolha por tecnologias assistivas.
- Os links WhatsApp e e-mail são preparados com **apenas o nome público do serviço**. Nenhuma mensagem é enviada automaticamente.
- Nas páginas dos seis serviços, o CTA **Comparar soluções** passa a apontar para `/comparar-solucoes/`, que já existe, em vez de retornar ao catálogo geral.
- Testes Node e Playwright 375/1440 px cobrem o carregamento por slug, alteração por seletor, hashchange válido, fragmento arbitrário, status acessível e links internos. Sem formulário, consentimento registrado, sessão ou API CRM.

O conteúdo continua sujeito às aprovações comerciais e ao gate de lançamento da VPS/Portal/CRM. Não há credenciais, PII, cookies, deploy, DNS ou mudança da `main` nesta fase.
