# F238 — CI de HTTP local sobre o build Astro real

**Problema resolvido:** F232–F236 validam a auditoria de staging por testes sintéticos, mas não percorriam o conjunto integral de HTML e assets gerados por `npm run build` na mesma execução.

O passo `node scripts/test-compiled-staging-http-ci.mjs`, colocado depois do `verify-dist.mjs` no workflow de SEO/Build, executa a revisão completa sobre o `dist` recém-compilado:

1. enumera os arquivos e valida o inventário SHA-256 de `dist` usando o mesmo contrato F22/F217;
2. abre servidor Node temporário exclusivamente em `127.0.0.1` com porta efêmera e Basic Auth **sintético**;
3. retorna os bytes exatos do build para todas as páginas Astro, assets e 404, simulando os cabeçalhos e MIME esperados;
4. chama o verificador de operador F232–F236 para exigir HTTP 401 anônimo, 200/404 autenticado, igualdade de HTML, binários e tipo de mídia, além do hash pós-revisão;
5. encerra o socket e elimina o arquivo htpasswd sintético em diretório temporário, mesmo sob falha.

**Limitações e controles:** o servidor de teste é Node, **não Nginx**, e não representa Leaseweb; o SHA de CI é calculado do próprio build e portanto **não constitui pin externo independente**. A imagem Nginx e o bcrypt do ensaio são strings sintéticas. O script recusa variáveis operacionais de imagem, pin e senha, não utiliza SSH, Docker, dados reais, endpoint externo nem token. Não salva a resposta HTTP ou segredos em artefatos. O relatório expressa `pinIndependentlyVerified:false`, `privateNginxOrLeasewebVerified:false`, `deploymentAuthorized:false`.

A homologação real permanece obrigatória pelo procedimento em `ops/staging/README.md`, com imagem por digest auditada, rede/TLS, credenciais privadas e pin independente.

Nenhum 301, DNS, `main`, formulário público ou deploy foi alterado nesta etapa.
