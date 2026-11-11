# Comercial SEO-F157 — Comportamento HTTP das URLs legadas em HOLD

A migração do domínio da Imagine possui cinco URLs legadas candidatas à equivalência e 18 sem destino aprovado. Como a autorização dos redirects ainda não ocorreu, **o site de revisão Astro não pode redirecionar nenhuma dessas rotas** para uma página genérica nem servir soft-404.

O Playwright agora requisita duas URLs candidatas e três URLs em HOLD em `127.0.0.1`, exige status HTTP **404**, endereço sem alteração, documento personalizado de não encontrado, `robots=noindex,nofollow`, sem canonical ou dados estruturados e com navegação segura para os serviços públicos. Essa prova é executada apenas em viewport mobile porque o status HTTP independe de layout.

A suíte Cloudflare Workerd existente permanece separada: copia um plano de **simulação** para diretório descartável, ensaia 301 nas candidatas e exige 404 nas 18 rotas em HOLD. Os arquivos `_redirects` dessa simulação não entram no diretório publicável nem autorizam produção.

**NO-GO:** inventário completo do legado, autorização editorial 1:1, status HTTP real e plano de rollback ainda são necessários antes de qualquer DNS, redirect 301 ou deploy. Nenhum dado de visitantes ou credencial Google é usado no teste.
