# F306 — Build protegido com catálogo cumulativo assinado

## Problema resolvido

Lotes parciais de publicação CMS não devem apagar revisões assinadas feitas em serviços que não aparecem no lote mais recente. A F305 reconstrói o histórico offline; a **F306 integra essa reconstrução ao compilador Astro e ao verificador independente do HTML entregue**.

A implementação mantém o caminho atual de um único snapshot assinado por compatibilidade. O modo cumulativo é ativado **somente** quando o operador fornece a cadeia completa a partir de um checkpoint com os seis serviços e a verificação externa de seu hash.

## Entradas obrigatórias no modo cumulativo

As cinco variáveis já exigidas para build assinado permanecem: `IMAGINE_CATALOG_ENVELOPE_FILE`, `IMAGINE_CATALOG_PUBLIC_KEY_FILE`, `IMAGINE_CATALOG_TRUSTED_KEY_ID`, `IMAGINE_CATALOG_EXPECTED_RELEASE_ID`, `IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256`.

Para ativar histórico, fornecer **juntas**:

- `IMAGINE_CATALOG_HISTORY_FILE` — arquivo JSON privado, de até 4 MiB, sem symlink, com apenas `{"schema":"imagine.comercial.signed-history-package.v1","releases":[{"envelope":{...},"pin":{"expectedReleaseId":"...","expectedPayloadSha256":"..."}},...]}`
- `IMAGINE_CATALOG_HISTORY_SHA256` — SHA-256 de **todo o conteúdo UTF-8** desse arquivo, emitido e conferido por uma fonte independente do candidato a build.

O último envelope da lista deve ser **literalmente igual** ao `IMAGINE_CATALOG_ENVELOPE_FILE` selecionado, incluindo `keyId`, bytes base64 da publicação e assinatura. Cada entrada é verificada por Ed25519, seu `releaseId` e seu SHA-256, com o checkpoint inicial completo, versões monotônicas e publicação já vigente. Dados comerciais privados, preços e rotas inéditas continuam proibidos.

O par arquivo/hash isolado **não comprova que o Portal entregou o histórico completo nem que houve aprovação de publicação**; a origem confiável dessa prova é um requisito operacional independente.

## Verificação do mesmo pacote em dois momentos

1. O compilador `loadBuildServices` lê o pacote, confere o hash externo e preserva as alterações assinadas de todas as publicações anteriores.
2. `scripts/build-protected-release.mjs` valida **antes do build**, compila e verifica o HTML de cada um dos seis serviços contra o catálogo cumulativo. Erros invalidam a compilação.
3. `scripts/verify-protected-package.mjs` lê novamente o mesmo pacote histórico e seu pin por fonte confiável e compara os bytes finais ao artefato conferido.
4. O verificador de witness F47 pode receber o mesmo pacote histórico e seu pin em memória. Isso não equivale a autorização, receipt remoto ou aprovação do Portal.

A ausência de ambas as variáveis mantém o fluxo legado de um snapshot. **A presença de apenas uma é erro**; histórico presente sem release assinado não permite fallback editorial. Testes usam chaves e arquivos efêmeros com publicações fictícias; nenhuma chave privada precisa ser instalada no servidor do site.

## Limites / NO-GO

A F306 não configura MFA, autoriza tenants, obtém catálogo por HTTP, grava banco real, gera 301, publica no servidor Leaseweb ou muda a `main`. O histórico precisará de atestação da fonte de verdade do Portal, ledger transacional e revisão AppSec/DBA/LGPD antes de homologação operacional. Os relatórios continuam explicitamente `REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY`.
