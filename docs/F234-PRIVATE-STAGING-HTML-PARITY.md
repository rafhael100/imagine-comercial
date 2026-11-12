# F234 — Paridade exata de HTML HTTP × pacote aprovado em staging privado

F232 exigiu cobertura integral de rotas e F233 passou a conferir o hash SHA-256 do pacote antes e depois das respostas HTTP. A F234 fecha outra lacuna: **um Nginx com `dist` local válido poderia estar servindo outra versão do HTML** por montagem incorreta, cópia antiga ou erro de configuração.

Na revisão única do operador:
1. conferir `dist` inteiro com SHA esperado fornecido independentemente;
2. ler com limite de 1 MiB, UTF-8 estrito e `O_NOFOLLOW` todos os HTML públicos do catálogo e `404.html`;
3. executar o desafio anônimo 401 e os GET autenticados sobre **todas** as páginas e 27 caminhos históricos;
4. comparar o corpo HTML decodificado de cada 200/404, de forma **exata**, com a referência local: páginas públicas com HTML individual do pacote e rotas históricas com `404.html`;
5. repetir verificação integral SHA do pacote ao terminar o HTTP (F233).

O relatório só emite `servedHtmlMatchesLocalPinnedBuild:true` e contagem de páginas comparadas quando **todas** as comparações passam. Nunca imprime HTML, caminhos privados, chaves, senha ou hash esperado. Teste simula HTML antigo mas com canonical/robots ainda válidos; a nova verificação o rejeita. Teste preserva recusa de pacote alterado durante a revisão.

**Limites:** a equivalência é observada somente na porta local `127.0.0.1` ou túnel SSH autorizado e não comprova por si só o TLS externo, a identidade remota, DNS, integridade do contêiner, dados reais, Search Console ou autorização de publicação. O staging conserva Basic Auth e `X-Robots-Tag: noindex`. `main`, produção, DNS e redirects 301 não são tocados.
