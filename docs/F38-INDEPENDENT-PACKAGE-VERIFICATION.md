# F38 — Verificação independente de pacote compilado e assinado (offline)

Data: 09/11/2026. A F38 adiciona uma **segunda verificação somente de leitura** do pacote Astro produzido pelo F37. Não existe deploy nem homologação de rede nesta etapa.

## Problema tratado

O F37 verifica a assinatura Ed25519 do catálogo e produz `PROTECTED-BUILD-REVIEW-ONLY.json` com SHA-256 dos arquivos do build. Mas o relatório acompanha o pacote e **não é uma atestação confiável por si só**: uma pessoa que altera `dist/index.html` também pode alterar o hash no JSON. Para detectar alterações após a compilação, o verificador de destino precisa receber um hash esperado por um **canal confiável separado**, não deduzi-lo do pacote.

## Procedimento técnico

`npm run verify:protected` executa `scripts/verify-protected-package.mjs`, em workspace isolado com a árvore `dist/`, envelope assinado e relatório de revisão original. O orquestrador protegido deve fornecer **independentemente**:

- `IMAGINE_RELEASE_TARGET=staging` ou `production`
- `IMAGINE_CATALOG_ENVELOPE_FILE` e `IMAGINE_CATALOG_PUBLIC_KEY_FILE`, caminhos para arquivos locais regulares, não symlinks, com limites de tamanho
- `IMAGINE_CATALOG_TRUSTED_KEY_ID`
- `IMAGINE_CATALOG_EXPECTED_RELEASE_ID`
- `IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256`
- **`IMAGINE_EXPECTED_BUILD_TREE_SHA256`**, o SHA-256 esperado de toda a árvore de arquivos obtido por canal confiável separado

A verificação falha se o relatório da compilação tiver campos extras, formato ou modo alterado, destino diferente, `deploymentPerformed` não falso, keyId ou releaseId divergentes, SHA-256 diferente, arquivos adicionais, scripts de deploy, symlinks ou HTML que não corresponda aos serviços assinados. O catálogo é verificado criptograficamente de novo, e todos os arquivos são relidos antes da comparação.

O retorno é somente uma confirmação `OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY`. Nenhuma credencial de produção, chamada externa, repositório remoto, DNS ou Cloudflare é usado. Ele não grava arquivos, não troca conteúdo e não faz deploy.

## Exercícios automatizados no CI

O teste integrado com chaves **sintéticas descartáveis**:

1. Cria catálogo assinado, compila com F37 e captura o SHA-256 produzido.
2. Verifica o mesmo pacote com o SHA-256 esperado fornecido separadamente.
3. Rejeita árvore esperada incorreta, releaseId diferente, modo `review` e relatório adulterado.
4. Modifica bytes da homepage sem alterar metadados de serviço e confirma que a auditoria detecta a mudança.
5. Restaura o conteúdo de teste e comprova que o pacote original volta a verificar.

Os testes unitários adicionais impedem que configurações inválidas ou relatório com alegação de deployment sejam aceitos.

## Gates restantes — não resolver apenas com SHA-256

O hash da árvore **não é uma assinatura operacional**: a confiabilidade depende da origem do hash esperado e de uma atestação de CI/Portal aprovada. O futuro publicador de mínimo privilégio ainda precisa de autenticação e MFA/grants, chave e revisão editorial operacional, witness externo não reversível por restore local, receipt real do destino e autorização separada de staging/produção. Não copiar segredos para o GitHub público.

Também continuam pendentes o acesso à VPS Leaseweb, CRM com consentimento LGPD versionado e idempotência durável, GSC/crawl históricos, aprovações de textos/contatos/planos/preços e testes de DNS/Cloudflare reais.

**Sem merge na main, alteração DNS, despesas ou coleta de dados reais.**
