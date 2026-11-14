# F54 — Piso monotônico de política assinada (PostgreSQL, falha fechada)

O marco F45 exigia que o orquestrador fornecesse uma versão mínima de política por canal confiável, mas não mantinha essa versão automaticamente entre processos. A F54 introduz uma tabela PostgreSQL durável **proposta** (`db/migrations/002-witness-policy-floor.sql`) e um adaptador que vincula atomicamente versão da política e nonce da testemunha.

- A política deve ter assinatura Ed25519 da raiz independente validada **antes** de qualquer escrita; o digest SHA-256 cobre os campos assinados.
- O registro persistido por `(signer_key_id,witness_key_id)` só progride para versão **maior**; uma versão igual é aceita apenas com **digest idêntico**, evitando bifurcação com mesmo número.
- O SQL de verificação de recibo usa `WITH floor_guard ... nonce_guard`, uma **única instrução PostgreSQL**. O nonce só pode ser inserido se a versão autenticada não estiver ultrapassada.
- A operação independente `promoteAuthenticatedSignedPolicy` pode registrar **política assinada revogada ou suspensa**, sem aceitar nenhum recibo, evitando que uma política ativa antiga permaneça sendo usada após a distribuição confiável da revogação.
- A rotina `verifyReceiptWithPostgresPolicyFloor` valida política e recibo (F45/F44/F39) antes da reserva e exige um cliente de BD injetado.

**Limites fundamentais:** não existe coleta/distribuição remota confiável de revogação implementada. Se uma revogação nova não chegar ao serviço persistente, o banco não consegue adivinhá-la. A raiz, o bootstrap, o `minSequence` inicial e o relógio precisam de fontes operacionais autenticadas; a migração e os grants do banco real da VPS ainda não foram aplicados. A transação não autoriza deploy, DNS ou publicação e não substitui recibo de entrega remoto. CI usa chave temporária e PostgreSQL somente em runner descartável. Sem credenciais/PII ou novos custos.
