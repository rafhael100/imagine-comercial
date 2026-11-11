# Comercial SEO-F145 — Detectar páginas órfãs e distância de navegação

O relatório de sitemap já impede rotas falsas; a auditoria F143 verifica se cada link interno aponta para uma rota pública existente. A F145 completa essas garantias confirmando que **todas as páginas indexáveis do Astro têm um caminho de navegação desde a página inicial**, com no máximo três links percorridos. A análise usa apenas os arquivos HTML compilados e o catálogo de rotas do build, sem HTTP, Google, rastreamento de visitantes ou ferramentas de terceiros.

Isso protege os novos conteúdos editoriais, incluindo o guia de criação de sites para Fortaleza, de ficarem visíveis apenas pelo sitemap, sem acesso por navegação normal. Fragmentos da página e canais externos não contam como novas páginas. Testes verificam grafos sem caminho, profundidade excessiva e tentativa de apresentar URL externa como link interno.

Nenhuma publicação ou alteração operacional foi realizada: a melhoria fica em branch/PR draft até revisão de conteúdo e liberação controlada. Sem DNS, redirecionamentos, deploy ou merge na `main`.
