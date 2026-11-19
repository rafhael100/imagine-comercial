# F23 — Smoke HTTP completo no Cloudflare Workerd local

Referência: 09/11/2026. Laboratório isolado, **sem Cloudflare de produção**.

## Motivação
A simulação F19 já verificava cinco redirecionamentos antigos como 301, duas páginas públicas como 200 e onze caminhos legados ou inexistentes como 404. Entretanto, apenas duas páginas publicáveis eram testadas no runtime Cloudflare.

## Ampliação F23
- O laboratório Workerd com Wrangler fixado verifica **todas as 15 rotas públicas** declaradas em sitePages.
- Exige HTTP 200, Content-Type HTML e canonical/robots/og:url coerentes em cada uma.
- Confirma HTTP 200 para robots.txt e sitemap.xml, com referências idênticas ao catálogo público curado.
- Preserva cinco 301 candidatos exclusivamente na **cópia temporária** do build usada no Workerd local.
- Preserva 11 respostas 404 para URLs HOLD e caminho inexistente; cada 404 deve conter conteúdo explicativo, noindex e ausência de canonical.
- A execução continua com loopback 127.0.0.1 e pasta descartável. O arquivo _redirects de simulação nunca pertence ao build original.

## Evidência esperada
O workflow commercial-cloudflare-migration-lab.yml é acionado pelo PR quando scripts/test-workers-local-migration.mjs muda. A execução precisa passar para registrar aprovação técnica da simulação.

## Limites
Os códigos 301 são candidatos ficticiamente ativados **apenas no diretório temporário**. Isso não aprova migração de nenhuma URL ou alteração de DNS. Não cobre CDN pública, propagação TLS/host www, cache global, dados de Search Console, experiência de usuários, API real do Portal, pagamentos ou staging autorizado.
