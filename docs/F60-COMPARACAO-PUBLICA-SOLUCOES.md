# F60 — Página pública para comparar soluções (sem preços ou perfil de visitante)

A F60 acrescenta a rota estática `/comparar-solucoes/` ao Imagine Comercial. O conteúdo apresenta dois grupos de opções, com seis serviços já presentes no catálogo:

- **Presença digital:** Onepage, criação de sites, Landing Pages e sites por assinatura.
- **Mídia:** gestão de Google Ads e Meta Ads.

Cada comparação traz: quando considerar, como costuma se organizar e uma pergunta útil para o briefing. Todos os cartões oferecem link para conhecer a solução e para `/contato/#slug`. Não apresenta preços, garantias de resultado, recursos incluídos por plano, dados de clientes, rankings ou propostas automáticas. A escolha final depende de análise e proposta oficial.

## Implementação e controles

- Conteúdo curado em `src/data/service-comparison.mjs`, com verificação automática de **cobertura exata** dos seis slugs existentes e grupos imutáveis.
- Página HTML estática, sem JavaScript cliente, formulários ou requisições a terceiros. Links internos exclusivos.
- A rota foi adicionada ao catálogo de páginas do site, sitemap, verificações de canonical/HTML e auditor SEO independente; a página recebeu links a partir da home e do diretório de serviços, evitando isolamento.
- QA Playwright visita a nova rota em 375 px e 1440 px, testa cartões, três critérios, doze links e clique real em Contato para Landing Pages. Auditoria WCAG 2.1 A/AA com axe.
- Testes Node confirmam ausência de serviços esquecidos, preços inventados e caminhos externos.

A comparação descreve **cenários genéricos**, não elegibilidade, decisão automática, contrato, aceite, lead nem compromisso de investimento. Não envolve CRM, Portal, dados pessoais ou VPS. Deploy e DNS continuam bloqueados até homologação e aprovação responsável.
