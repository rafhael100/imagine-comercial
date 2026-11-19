# F14 — Fixação explícita do lote de conteúdo público assinado

## Problema tratado
Uma assinatura Ed25519 válida não significa que um conteúdo seja a **versão exata autorizada** para a publicação específica. Um emissor pode produzir várias versões corretamente assinadas; o build deve exigir uma referência independente do lote pretendido.

## Implementação
- `IMAGINE_CATALOG_EXPECTED_RELEASE_ID` e `IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256` devem vir juntos das três variáveis F9; nenhuma configuração parcial é aceita.
- Após verificar a assinatura, o Astro valida que o `releaseId` corresponde ao release esperado e que o hash SHA-256 dos **bytes exatos assinados** corresponde ao valor fixado.
- Se a assinatura, release ID ou hash falhar, o build aborta. O modo editorial manual inicial continua funcionando quando nenhuma variável de snapshot está configurada.
- Testes Node verificam publicação assinada, versão inesperada, hash trocado e configuração parcial; integração compila HTML com chave descartável e tenta um release alternativo para comprovar falha.

## Importante: limites deste gate
- A configuração esperada é apenas um **pin de integridade**, não prova de aprovação. Uma automação maliciosa com permissão de editar o pin e o arquivo poderia escolher ambos; o Portal deve validar autenticação/MFA, papéis, aprovação editorial e política de liberação antes da emissão.
- Proteção durável contra replay e rollback depende de armazenamento transacional independente do snapshot e do operador de build, não implementado aqui.
- Hash SHA-256 e release ID são públicos e não constituem segredos. Não incluir chaves privadas ou dados de clientes em artefatos.
- Nenhuma conexão ao Portal real, deploy, merge main ou mudança do domínio.

Referência: PR #11 de consumo Astro e PR #119 do emissor PHP no Portal.
