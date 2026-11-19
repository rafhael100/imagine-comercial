# F65 — Perguntas frequentes comerciais sem captação

Nova rota `/perguntas-frequentes/`: quatro categorias (escopo, proposta/condições, anúncios/resultados, aprovações/acesso) e oito respostas editoriais, sem duplicar os FAQs técnicos de cada serviço.

A página evita afirmações que dependem de contrato: valores, revisões, prazos, investimentos em anúncios, continuidade e disponibilidade do Portal somente são confirmados na proposta vigente e após homologação dos canais. Inclui orientação explícita para **não** compartilhar senhas ou dados sensíveis pelos links públicos.

O HTML é totalmente estático e usa `<details>/<summary>` nativos para navegação acessível sem JavaScript. Não há formulário, cookies, armazenamento, analytics, login, coleta de PII ou chamada a APIs. A página foi adicionada ao catálogo de canonical/sitemap e ligada ao footer, à página Como funciona e ao Contato.

Os testes Node verificam oito respostas distintas, ausência de garantias e transportes de dados. O Playwright valida presença e funcionamento da expansão, responsividade e WCAG 2.1 A/AA em viewports 375 e 1440 px, junto ao auditor SEO RC13.

Conteúdo sujeito à revisão comercial e jurídica antes da publicação real. Não habilita Portal/CRM, VPS, redirects, DNS ou custos.
