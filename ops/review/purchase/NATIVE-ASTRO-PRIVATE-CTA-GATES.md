# P0 — CTAs nativos no Astro: modo público preservado e prévia privada opt-in

A página de origem `src/components/QuickServiceRequest.astro` passa a aceitar somente um **modo de CI para revisão**, construído a partir do mesmo código Astro (não somente do HTML transformado após build).

- **Padrão público:** seis CTAs continuam abrindo o WhatsApp aprovado, sem links ao Portal de testes.
- **Candidato CI:** com `GITHUB_ACTIONS=true` **e** `IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW=1`, os quatro CTAs Onepage, Landing Page, Google Ads e Meta Ads passam a apontar ao host privado HTTPS do Portal, com SKU/canal permitidos. Outros dois cards continuam abrindo WhatsApp.
- A prévia inclui aviso expresso de ausência de contas, contratos e pagamentos reais.
- O próprio Astro gera o HTML dos links, preservando as classes CSS, a arte existente e o hero aprovado; a CI verifica que o build original não mudou de comportamento, e não publica o resultado.
- A política de origem/canais é a mesma da PR Comercial #378 e o Portal reconhece o contexto na PR Portal #746.
- No build normal, definir somente um dos dois flags não é suficiente para ativar a prévia. Configurar variáveis da prévia em hospedagem pública é proibido pela política operacional.

## Não é um botão de contratação pública

Não há rota pública/contrato/ledger financeiro homologados, login definitivo, pagamento Asaas real, emissão fiscal ou provisionamento produtivo. A infraestrutura e o domínio público não são modificados por esta PR. A presença do link privado em uma compilação de laboratório não significa disponibilidade do destino para clientes.

**DRAFT / NO-GO / NO-MERGE / NO-DEPLOY.** Quando a autenticação, as rotas e o Asaas estiverem aprovados em ambiente operacional, criar integração pública distinta com URL oficial e testes reais, sem reutilizar a rota `/_preview`.
