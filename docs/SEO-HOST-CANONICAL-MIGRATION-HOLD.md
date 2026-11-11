# Canonicalização de host — www → domínio principal (somente revisão)

Os dados reais de Search Console mostraram registros para a versão `www.imaginecomunicacao.com.br` e, em menor quantidade, para a versão sem `www`; a nova aplicação Astro declara URLs canônicas em `https://imaginecomunicacao.com.br`. A propriedade GSC do domínio inteiro está selecionada no OpenSEO, **sem autenticar** o Portal.

A função `reviewCanonicalHostMigration` consome somente a classificação offline de páginas GSC. Identifica se um caminho conhecido atual teria uma simples alteração de host, se a URL legada precisa equivalência editorial, se variantes de parâmetros precisam HOLD ou se a rota é desconhecida. **Nenhuma regra ou resposta 301 é gerada**; `approvedRedirects` e todas as flags de autorização permanecem falsas.

A CI utiliza apenas URLs, métricas e parâmetros fictícios. Dados GSC reais não são registrados no GitHub. A liberação exige inventário completo por Search Console + crawl + backlinks, equivalência editorial, configuração HTTPS dos dois hosts, decisão de canonical/hreflang, review de segurança e testes de staging. Não habilitar Cloudflare Worker, _redirects, DNS ou deploy automaticamente.
