# Comercial SEO-F154 — Leituras relacionadas em cada guia

Os artigos publicados no site Imagine agora apresentam **dois guias relacionados** em uma seção "Leia também" depois do conteúdo principal. As recomendações são curadas e armazenadas em `src/data/related-articles.mjs`, com slugs de páginas efetivamente publicadas no catálogo do projeto.

Não existe algoritmo de recomendação baseado em identidade, cookie, rastreamento, SEO externo ou histórico de leitura. Um artigo não pode recomendar a si próprio, repetir um destino ou apontar para um conteúdo ausente. Os títulos/temas vêm dos próprios artigos revisados.

A página preserva o sumário navegável F153, a hierarquia semântica dos títulos e todos os links sem JavaScript. Testes de catálogo e Playwright desktop/mobile/navegação sem scripts validam os destinos reais; a auditoria de links internos F143, âncoras F147/F148 e páginas órfãs F145 continua ativa.

A funcionalidade permanece em branch/CI de revisão editorial. Sem publicação, dados de visitantes, OAuth, DNS, redirects, merge `main` ou despesas novas.
