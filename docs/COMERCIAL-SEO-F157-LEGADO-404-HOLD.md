# Comercial SEO-F157 — URLs legadas pendentes sem redirecionamento operacional

O laboratório Astro Preview passa a abrir URLs antigas selecionadas do inventário `legacyUrls` (duas candidatas e três com HOLD), exigir HTTP **404 real**, permanência na URL de origem, resposta `noindex,nofollow`, ausência de URL canônica e dados estruturados publicáveis, e uma navegação útil para os serviços. Esses testes impedem que um site em análise simule migração já aprovada ou produza *soft 404* silencioso.

A simulação de HTTP 301 para candidatas continua **separada** e isolada no ambiente descartável do Cloudflare Workerd. Seus `_redirects` são gerados apenas na cópia temporária, nunca em `public/` ou `dist/` do pacote final. É proibido concluir, a partir desse ensaio, que equivalência editorial, inventário legado, DNS ou migração tenham sido homologados.

**NO-GO:** nenhuma ativação de redirects reais, alteração de DNS, deploy, merge `main`, captação ou credencial Google. Antes de autorizar 301, faltam auditoria de URLs antigas e respectivas respostas atuais, matriz 1:1 de equivalência, revisão editorial, plano de rollback e aprovação de publicação.
