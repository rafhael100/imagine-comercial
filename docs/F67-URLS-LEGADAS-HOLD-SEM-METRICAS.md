# F67 — Inventário adicional de URLs antigas, sem redirecionamentos

O fluxo de auditoria obteve acesso **somente de leitura** à propriedade `https://www.imaginecomunicacao.com.br/` no Google Search Console via conector autorizado. Os dados de desempenho, termos de pesquisa, contagens, CTR e posições **não** são gravados no repositório ou nos logs do CI.

O inventário local de caminhos legados em `src/data/legacy-urls.mjs` foi ampliado com oito **URLs públicas** que ainda demandam análise editorial, jurídica ou comercial: página de recrutamento, rota histórica de contato, e seis páginas de serviços em inglês (loja virtual, Meta, Google, LinkedIn, Amazon e Mercado Livre). Todas têm `status:'hold'` e `to:null`. A auditoria de redirects simulados mantém as cinco propostas anteriores **apenas para revisão**, nunca como regras deployáveis.

**Importante:** linhas de Search Analytics não são um crawl, não comprovam HTTP 200 atual e não são inventário completo de URLs históricas. URLs antigas podem não ter impressões na janela consultada; o volume e presença nas SERPs não provam equivalência de conteúdo. É necessário conferir o host final (www/apex), redirects atuais, links, sitemap, consentimentos/privacidade, versão em inglês e página de portfólio antes de liberar qualquer regra.

Qualquer execução real de GSC export/crawl deve permanecer em ambiente privado, fora do GitHub público. Os scripts F26/F27 continuam aceitando CSV offline e sanitizam parâmetros de URL; o CI utiliza **apenas fixtures sintéticas**. Nenhum login OAuth novo, dado privado, clique, consulta, regra _redirects, mudança de DNS, banco, deploy ou despesa foi incluído nesta PR.
