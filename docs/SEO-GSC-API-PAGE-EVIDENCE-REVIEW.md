# SEO — Evidência de páginas do Search Console para a migração (somente revisão)

A função `reviewGscApiPageEvidence` aceita uma resposta Search Analytics **fornecida ao programa** na dimensão `page`, sem chamar Google. Valida host Imagine, formato de linhas/métricas, variantes com query, inconsistências, limites de até 1.000 entradas e metadados incompletos; reutiliza o inventário de caminhos legados e o classificador CSV atual do Comercial. Retorna caminhos saneados, classificação de cada URL e sinais de priorização por impressões, **nunca regras de redirect**.

A propriedade URL-prefix `https://www.imaginecomunicacao.com.br/` já retornou 23 linhas de desempenho no OpenSEO em 11/11/2026, mas esses dados reais **não entram no GitHub ou na CI**. Esta feature usa exclusivamente URLs e métricas fictícias nos testes. A ligação Google do OpenSEO não autentica o Portal nem concede permissão ao motor SEO.

Antes de qualquer 301: demonstrar cobertura histórica por exportação e crawl, equivalência editorial 1:1, revisão de backlinks/SEO e aprovação operacional com Gate F70, equipe responsável, TLS/DNS e staging. Não redirecionar serviços antigos sem equivalência para a homepage. `approvedRedirects = 0` e `productionRedirectsAuthorized = false` invariáveis. Nenhum deploy, DNS, OAuth, custo ou merge `main`.
