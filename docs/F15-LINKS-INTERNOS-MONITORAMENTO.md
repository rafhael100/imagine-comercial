# F15 — SEO de links internos com bloqueio de regressões no build

## Entrega
O pipeline do site comercial executa uma versão **fixada por SHA** do Imagine SEO Engine contendo controles de grafo de navegação.

Requisitos adicionais:
- Cada página pública deve ter caminho de navegação a partir da homepage.
- As páginas não devem estar órfãs ou exigir profundidade excessiva (mais de 3 cliques).
- Corrigir links quebrados, canonicals e sitemap continua obrigatório.
- Habilitado `--fail-on-warnings`, que considera qualquer aviso da auditoria um bloqueio técnico no CI. A política é propositalmente mais rigorosa para este site do que a biblioteca padrão.
- Testes são locais sobre a compilação Astro, sem rede, coleta de visitantes, Search Console ou publicação.

## Arquitetura
- Auditor independente: `rafhael100/imagine-seo-engine`, commit `9f534400b0f0b68de15578ceee481a2ba1aa6752`.
- Consumidor: Imagine Comercial, workflow `.github/workflows/validate.yml`.
- Inspeção de UI real: Playwright, em etapa separada, preservada.

## Limitações
A profundidade dos links no HTML compilado não mede autoridade, ranking ou indexação no Google. A análise de links renderizados dinamicamente, redirects e experiência real depende de crawler/navegador e Search Console autorizados.

Não houve merge em `main`, deploy, DNS, configuração de domínio ou despesas.
