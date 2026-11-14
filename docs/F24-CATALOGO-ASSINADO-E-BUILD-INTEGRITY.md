# F24 — Conferência do lote assinado contra o HTML e o hash do build Astro

Data: 09/11/2026. **Laboratório de integração; não habilita publicação.**

## Objetivo
A F22 produz um inventário SHA-256 do build estático e a F14 já exige releaseId + SHA-256 do catálogo antes da compilação. A F24 verifica também que os metadados assinados do Portal aparecem **exatamente** no HTML publicado pelo processo de build, vinculando o identificador do release ao digest do conjunto de arquivos gerados.

## Fluxo de validação
1. Receber um envelope de catálogo assinado Ed25519, com chave pública confiável e identificador conhecido (na CI, apenas chaves efêmeras).
2. Validar a assinatura, o conteúdo publicável e os pins de releaseId e SHA-256 do payload.
3. Inspecionar somente páginas do catálogo editorial permitido, conferindo canonical, robots, og:url e igualdade do título, da meta descrição e do resumo na seção hero.
4. Conferir a árvore de arquivos gerados pelo Astro, sem HTML inesperado, arquivos privados, _redirects ou symlinks.
5. Retornar um relatório local com releaseId, keyId, payloadSha256, treeSha256 e quantidade de serviços testados, sempre marcado como SIGNED_BUILD_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY.
6. Na integração de CI, compilar um snapshot de teste com chave efêmera, avaliar o relatório, adulterar uma cópia do HTML para comprovar a rejeição e reconstruir o site editorial padrão ao final.

## Evidências e limitações
- Código: src/lib/signed-build-review.mjs.
- Regressão: tests/signed-build-review.test.mjs.
- Integração com build real: scripts/test-build-catalog.mjs.
- A comprovação de correspondência com chave pública em laboratório **não prova** aprovação humana, MFA, AuthN/AuthZ, tenant, autorização de operação, revogação em storage durável nem confirmação remota de publicação.
- O relatório não é uma assinatura do artefato: quem altera o build e os metadados de revisão pode gerar outro digest. É necessária uma cadeia de confiança externa com concessões de acesso, chaves operacionais, identidade e registro transacional.

Sem deploy, merge em main, DNS, transferência de credenciais, dados reais de clientes, redirecionamento produtivo ou integração com fornecedor pago.
