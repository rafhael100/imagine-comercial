# F242 — JSON privado do Search Console não sai do computador do operador

## Lacuna eliminada
O antigo `scripts/review-gsc-api-json.mjs` (F68) escrevia um relatório derivado da exportação privada do Google Search Console em `artifacts/gsc-review/GSC-PRIVATE-REVIEW-ONLY.json`. Embora o diretório seja ignorado pelo Git, essa persistência local seria incompatível com o padrão estabelecido pela F224 para CSV real e cria risco de cópia/acesso/acoplamento a uploads futuros.

## Nova operação
```sh
node scripts/review-gsc-api-json.mjs --file /caminho/privado/gsc-pages.json
```

O CLI agora:
- recusa execução sob `GITHUB_ACTIONS=true` e argumentos extras;
- abre o arquivo por descritor seguro `O_NOFOLLOW`, com tamanho máximo de 2 MiB e UTF-8 fatal, reutilizando `readApprovedFile`;
- mantém a classificação de páginas, candidatos e HOLD do F68 sem métricas/URLs no console;
- **não cria arquivos, pastas, HTML, JSON ou CSV em `artifacts/`**; imprime exclusivamente contagens e flags NO-GO;
- não envia requests, não habilita um 301, não promove conteúdo do novo site e não expõe query tokens ou caminhos privados em erros.

Teste subprocesso cria um JSON privado com query token sintético e métricas; verifica que nenhum desses valores aparece em stdout/stderr e que nenhum diretório `artifacts/` surgiu. Também cobre symlink, UTF-8 inválido, tamanho excessivo, domínio estrangeiro, `query` dimension e execução CI.

**Acesso independente:** a propriedade GSC pode ser consultada por uma integração de pesquisa já conectada, mas isso não equivale à autorização OAuth/MFA/tenant do imagine-seo-engine ou do Portal, nem comprova inventário completo, backlinks, crawl atual ou equivalência editorial. Metadados de Google reais permanecem no workspace privado de SEO, não no GitHub público.

**NO-GO:** sem DNS, host redirect, captura, checkout, `main`, VPS real ou deploy.
