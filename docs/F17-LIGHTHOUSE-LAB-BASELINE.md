# F17 — Medição Lighthouse em Chrome local

## Implementado
- Workflow isolado executa o Lighthouse 13.6.0 com Chromium de testes e Astro preview local no GitHub Actions.
- Auditoria mobile de homepage e Landing Pages, com pontuação de performance, acessibilidade e SEO.
- Controle mínimo de 90/100 nas categorias SEO e acessibilidade, com relatórios JSON arquivados.
- Performance será registrada como linha de base observada; nota de performance oscila conforme CPU do runner e não é usada como gate rígido.
- Métricas de laboratório: LCP, CLS e TBT; não afirmar INP ou Core Web Vitals de campo.
- Sem autorização de domínio, dados de clientes, rede externa de análise, Google Analytics ou deploy.

## Próximos gates
Para medir usuários reais, obter consentimento e conexão autorizada com CrUX, Search Console ou telemetria adequada. Após criação de staging, repetir Lighthouse na hospedagem final e em dispositivos móveis físicos, avaliando cache e terceiros.

Documentação: https://github.com/GoogleChrome/lighthouse/blob/main/docs/headless-chrome.md
