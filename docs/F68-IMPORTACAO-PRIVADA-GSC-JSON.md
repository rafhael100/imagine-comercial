# F68 — Importador privado de resultados Search Console por página

A F68 complementa o leitor CSV offline F26 com uma entrada **JSON Search Analytics** de um conector autorizado, sem colocar a autorização OAuth ou dados de desempenho no GitHub.

`reviewGscSearchAnalyticsPages(payload)` recebe `siteUrl`, `dimensions:['page']` e `rows:[{keys:[url],...}]`. O relatório validado usa o inventário F26/F67; aceita somente as três propriedades previstas do domínio Imagine, rejeita dimensões de consulta, países etc. e **descarta** cliques, impressões, CTR, posição, metadados, queries e parâmetros privados das URLs. O resultado classifica cada caminho como rota atual, candidata **não aprovada**, HOLD ou desconhecida.

A ferramenta não consulta Google, não gerencia contas, não cria redirects, não classifica automaticamente destinos nem aceita aprovação de publicação. O script `scripts/review-gsc-api-json.mjs --file /private/export.json` é executado exclusivamente em ambiente privado, a partir de um arquivo fornecido pelo responsável. Grava o resultado em `artifacts/gsc-review/` (ignorado pelo Git, permissão 0600), e só imprime totais de categorias, nunca métricas.

No GitHub Actions o teste usa dados **sintéticos inventados**, por `npm test`, sem API do Google. O registro real deve continuar fora do repositório público, workflows e comentários de PR. O conector OpenSEO deu acesso somente de leitura à propriedade `https://www.imaginecomunicacao.com.br/` em 10/11/2026. Isso não prova cobertura total, crawl, equivalência de páginas nem autorização de 301. O gate #3 continua aberto.
