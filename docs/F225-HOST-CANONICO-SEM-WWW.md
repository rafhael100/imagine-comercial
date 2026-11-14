# F225 — Host principal sem www (decisao aprovada em 12/11/2026)

**Decisao de produto:** o endereco publico canonico do Imagine Comercial sera `https://imaginecomunicacao.com.br` (sem `www`). A mesma convencao vale para os novos projetos Imagine e, por padrao, para sites/landing pages de clientes em seus respectivos dominios. O site Astro ja aponta para essa origem em `astro.config.mjs`.

## Matriz de resultado desejado (nao implantada)

| Origem | Resultado desejado apos homologacao |
| --- | --- |
| `https://imaginecomunicacao.com.br` | 200 nas rotas publicadas; host canonico |
| `https://www.imaginecomunicacao.com.br` | 301 para HTTPS sem www, preservando caminho e query seguros |
| `http://imaginecomunicacao.com.br` | 301 para HTTPS sem www |
| `http://www.imaginecomunicacao.com.br` | 301 para HTTPS sem www |

**Importante:** a tabela define a politica de *host*, nao aprova redirecionamento de **caminhos legados**. Uma rota antiga sem equivalente aprovado permanece em HOLD/404; jamais redirecionar todas as rotas desconhecidas para a home. Evitar cadeia de redirects, loops e query strings com dados sensiveis. A estrategia de query deve ser revisada por rota.

## Proxima homologacao obrigatoria

1. Conferir as quatro variantes no staging privado com TLS valido e sem mudar DNS publico.
2. Comparar HTML, canonical, sitemap, robots, Open Graph, URLs internas, dados estruturados e hreflang, quando houver.
3. Inventariar URLs e sinais historicos Search Console, backlinks e rotas atuais; aprovar a equivalencia URL a URL antes de liberar 301 de caminhos.
4. Validar redirects de host em staging, sem loops, sem saltos adicionais e sem vazar dados em cabecalhos/logs.
5. Executar revisao independente SEO/AppSec/LGPD, registrar plano de rollback e obter autorizacao de publicacao.

`src/lib/canonical-host-policy.mjs` e os testes apenas registram/verificam a decisao: **zero regras 301 autorizadas**. Nao alterar `main`, Cloudflare, DNS, ambiente publico ou arquivos `_redirects` por esta entrega. A migracao continua DRAFT/NO-GO ate os gates.
