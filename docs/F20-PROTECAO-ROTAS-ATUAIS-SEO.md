# F20 — Proteção de rotas atuais e arquivos SEO na migração

Data: 09/11/2026  
Estado: implementação em PR de rascunho; **sem publicação**.

## Problema corrigido
Uma regra de migração não pode usar como **origem** uma rota válida do novo site, mesmo que o destino seja publicável e a linha esteja marcada como `candidate`, `hold` ou `approved`. O validador anterior checava se o destino era conhecido, mas não bloqueava todas as colisões de origem com páginas novas.

Isso poderia provocar um 301 sobre uma página canônica após um erro no manifesto de migração, afetando navegação, SEO e conversões.

## Proteções
- Bloquear origem igual a uma rota pública publicada no catálogo: homepage, contato, serviços, conteúdo editorial ou outras rotas do `sitePages`.
- Bloquear `/robots.txt`, `/sitemap.xml`, `/404.html` e todo o namespace `/.well-known/`.
- Rejeitar segmentos `.` e `..` em qualquer posição da origem, inclusive no final, para impedir ambiguidades de normalização.
- Preservar suporte a `candidate` e `hold` legítimos **sem gerar regras ativas**. `approved` permanece um estado explícito de laboratório e não comprova autorização de produção.

## Evidência esperada no CI
O novo arquivo `tests/redirect-source-safety.test.mjs` exercita as origens conflitantes, arquivos SEO, caminhos `well-known`, segmentos dot e regressão positiva para candidato/HOLD/approval sintético. O workflow padrão (`npm test`) executa estes casos junto com os testes atuais; o relatório de migração continua marcado REVIEW-ONLY.

## Limites e próximas verificações
F20 não constitui crawler completo do domínio legado, decisão 1:1, GSC, proteção contra todas as diferenças de normalização de proxies/CDN, homologação em staging ou aprovação de publicação. Antes do lançamento, revisar os hosts HTTP/HTTPS e www, os dados do GSC, o conjunto completo de URLs, os redirects candidatos e os controles de autenticação do Portal.

**Não criar `_redirects` real, não alterar `main`, DNS, Cloudflare produtivo ou URL pública.**
