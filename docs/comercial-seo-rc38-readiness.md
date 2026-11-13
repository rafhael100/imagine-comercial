# Imagine Comercial × SEO RC38 — Paridade e privacidade, sem atualização de pin

Revisão offline do auditor SEO [RC38 #129](https://github.com/rafhael100/imagine-seo-engine/pull/129) na HEAD imutável `b60e75fbd3402410f4b5bf91b9d1ab4249e2271f`, em comparação à candidata RC36 `440d515c1094ed5c8e0094c5c614fe1d6d49d881`.

## Ensaios executados pelo CI
- Checkout por **SHA fixo**, credentials não persistidas, Node 22, suíte offline completa do SEO RC38.
- Build Astro da DEV atual do Comercial com verificação de HTML e sitemap.
- Auditoria estrita do mesmo diretório `dist` pelos motores RC36 e RC38; exige paridade exata de sumário, inventário de rotas, erros e avisos. Uma alteração real nos relatórios obriga diagnóstico antes de avançar.
- Exercício real F89 de classificação de identificadores Unicode sintéticos; F88 revalida duas amostras de consultas originais fictícias, suprime tendências orgânicas e mantém apenas sugestão técnica de canonical. Flags de autorização permanecem falsas.
- As melhorias SEO-F90 (descrições duplicadas), F91 (âncoras estáticas) e F92 (IDs repetidos) não devem introduzir novos problemas no build Comercial já revisado. A igualdade dos relatórios é uma expectativa testada, não uma afirmação antes do CI.

**NO-GO:** nenhuma troca do auditor pinado no Comercial, merge em `main`, OAuth/Google real, credenciais, dados de clientes, DNS, 301, deploy, nova captação ou despesas. Este PR pode servir como evidência de paridade para revisão independente de SEO/AppSec/LGPD, mas não substitui homologação na Leaseweb.
