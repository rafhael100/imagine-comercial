# F82 — Protótipo privado de formulário de orçamento (sem envio)

## Entrega
Foi criado o arquivo isolado `tests/fixtures/private-contact-form-preview.html`, **fora de `src/pages` e fora do build público Astro**. Ele apresenta uma prévia acessível do possível futuro formulário comercial: nome, e-mail, telefone, solução, descrição e entendimento explícito de que a prévia não envia dados. O botão de envio permanece `disabled`; o formulário usa `method="dialog"`, não possui `action`, script nem dependência externa.

Não usar a prévia para colher dados reais ou solicitar consentimento jurídico: o texto explicita que campos obrigatórios, aviso de privacidade e base legal ainda precisam ser definidos e aprovados.

## Testes em navegador
`scripts/browser-qa.mjs` carrega o HTML com `page.setContent` apenas na memória do Playwright, após os testes de rotas públicas. Em viewports de 375 e 1440 px, valida controles nativos, e-mail sintaticamente inválido/válido, seleção de serviço, botão bloqueado, ausência de chamadas de rede, overflow e axe WCAG 2.1 A/AA.

`tests/private-contact-preview.test.mjs` confirma os seis slugs do catálogo e a ausência de rotas/integrações externas. Os testes F76 seguem impedindo que formulários apareçam no pacote `dist` público.

## Próximos gates técnicos e de Produto
- Definir política de entrada final: Comercial F30 exige e-mail, enquanto CRM F3-06 aceita e-mail ou telefone em um recorte específico; preservar a decisão no backend, não no HTML.
- Projetar e homologar serviço de captação com consentimento registrável, privacidade, antispam, rate limits, autenticação de origem, vínculo verificável de site/formulário/tenant, outbox e confirmação durável do CRM.
- Testar entrega/retry concorrente em staging privado, conformidade LGPD, segurança independente e disponibilidade dos canais alternativos.
- Validar paridade com o canal de orçamento legado (F70), depois aprovar separadamente migração SEO, release, DNS e plano de rollback.

Sem endpoint, webhook, banco, formulário público, dados pessoais reais, merge na `main`, deploy, DNS ou despesas. CI não equivale a autorização de produção.
