# F59 — Continuidade do objetivo comercial para o contato

A F58 orienta o visitante entre seis soluções. A F59 acrescenta a cada sugestão duas opções: conhecer o serviço e **conversar sobre aquele serviço**. A segunda opção usa exclusivamente um link interno `/contato/#slug`, sem nome, telefone, e-mail, cookies, gravação local ou requisições externas.

A página Contato já possui um seletor curado de serviços e reconhece somente slugs de sua lista. O link com fragmento seleciona o serviço e prepara a mensagem apenas no navegador, para os botões de e-mail e WhatsApp existentes. Nenhuma mensagem é enviada automaticamente: abrir o aplicativo externo depende de ação explícita do visitante.

## Testes
- Contrato Node assegura que todo `contactHref` usa `/contato/#` seguido de slug existente e nenhuma URL arbitrária.
- QA Playwright em 375 px e 1440 px percorre as cinco escolhas, verifica ambos os links por sugestão e executa a navegação completa Landing Page → Contato e Meta Ads → Contato, confirmando seletor e mensagem.
- F58 mantém fallback sem JavaScript: a listagem de todos os serviços e a primeira recomendação com ambos os links permanecem navegáveis.
- Os checks existentes mantêm proibição de POST, requisições a terceiros e armazenamento local durante as páginas testadas.

**Limites:** é orientação inicial, não cotação, abertura de lead no CRM, pedido enviado, consentimento cadastrado, checkout ou promessa de atendimento. Dados de preços e condições continuam sujeitos a proposta oficial e à futura integração autenticada com Portal/CRM. Nenhum deploy, DNS, `main` ou gasto novo.
