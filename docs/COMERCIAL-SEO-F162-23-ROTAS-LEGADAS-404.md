# Comercial SEO-F162 — Conferência completa das 23 URLs legadas em Astro Preview

A auditoria de navegador da F157 foi ampliada de uma amostra (2 candidatas e 3 HOLD) para **todo o inventário conhecido**: 5 rotas candidatas a migração e 18 rotas em HOLD. Para cada URL antiga, o Astro Preview de revisão deve devolver HTTP 404 real, sem redirect/soft-404, com `noindex,nofollow`, sem canonical ou JSON-LD e com um caminho útil de volta aos serviços.

A simulação Workerd continua independente: somente seu diretório descartável contém `_redirects` sintético para as cinco candidatas (testes de 301), enquanto as 18 URLs em HOLD permanecem com 404. A F161 verifica todas as 18 em staging privado; a F162 prova no navegador que nenhuma das 23 foi ativada no site original em revisão.

Essa diferença deliberada evita ativar regras de DNS/Cloudflare ou publicar redirecionamentos antes de equivalência editorial, inventário atual e aprovação. A prova é de laboratório e não autoriza migração operacional ou merge na `main`.
