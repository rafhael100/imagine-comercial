# Comercial F360 — consumo do Imagine SEO Engine F218 por SHA

Esta PR promove o pin somente no código de revisão do Imagine Comercial,
partindo da candidata F359, sem alterar páginas, serviços ou preços.

Nova SHA SEO Engine: 43953f44492f30546a6f0197e2998ea8a66ceffb
Referência: https://github.com/rafhael100/imagine-seo-engine/pull/329
Revisão consolidada: https://github.com/rafhael100/imagine-seo-engine/pull/330

**Validações continuadas no CI Comercial**
- npm test completo do Comercial;
- npm test completo da SHA SEO exata;
- auditoria independente das 63 páginas Astro com --fail-on-warnings,
  --strict-public-head --multilingual --check-hreflang;
- gates de robots path e declarações HTML sobre cópias do Astro compilado;
- QA Chromium, responsividade e acessibilidade existentes;
- PostgreSQL efêmero e proteção de CTA comercial já revisada.

**F214–F218**
O Engine acrescenta comparadores GSC com limiares inteiros e revisão offline
de canonicals contra GET independente do destino. A função de captura HTTP
F217 e o CLI de operador F218 têm origem pública fixa, limites e testes
sintéticos. Nenhum GET externo é feito pela execução padrão da CI Comercial.
O F218 recusa execução com GITHUB_ACTIONS=true. A coleta real depende de
operador e custódia privada; não há OAuth, consentimento do Portal ou
atribuição independente de origem comprovados nesta PR.

Este pin não executa mudanças no Joomla, não aprova canonical com alvo 302,
não prepara 301, não atualiza DNS nem publica Astro. A revisão P1 da
issue SEO #325 e o gate operacional F310 Comercial #466 continuam abertos.

DRAFT / NO-MERGE / NO-DEPLOY / NO-PSP / NO-GSC-CUSTOMER-DATA.
