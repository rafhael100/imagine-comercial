# F159 — Construtores de links comerciais agora rejeitam texto arbitrário

A auditoria estática e do navegador passou a exigir URLs exatas na F158; nesta entrega, o bloqueio também ocorre **na origem das URLs**, nos construtores `contactWhatsAppUrl` e `contactEmailUrl`. Antes, qualquer texto de WhatsApp iniciado por `Olá,` e contendo `Imagine`, ou assunto iniciado por `Contato Imagine`, podia ser codificado sem pertencer ao catálogo aprovado — ainda que a camada de auditoria posterior recusasse o link.

O novo módulo `src/data/curated-channel-text.mjs` calcula **560 estados** a partir exclusivamente do catálogo público existente de serviços, objetivos, momentos e prioridades. Expõe apenas predicados; os conjuntos internos não são exportados. O WhatsApp só aceita mensagens curadas, o e-mail só assuntos curados e um corpo opcional de e-mail deve pertencer exatamente ao par `(assunto, corpo)` gerado pelo mesmo estado do catálogo.

A suite de testes cobre as 560 combinações, pedidos de CPF/senha/pagamento fictícios, whitespace extras, assuntos falsos, associações incompatíveis entre dois serviços válidos, tipos inválidos e URL gerada maliciosamente fora dos construtores. Regressões da F155/F158 agora montam **links forjados manualmente** para testar também o auditor independente: não dependem da capacidade de gerar um link malicioso pela própria biblioteca.

Essa proteção não autoriza contatos automáticos, nem recebe leads, armazena dados, comprova a disponibilidade dos canais externos ou libera Portal/CRM, staging, `main`, DNS ou produção.
