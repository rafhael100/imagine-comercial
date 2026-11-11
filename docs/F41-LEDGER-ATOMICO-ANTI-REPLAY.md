# F41 — Contrato de ledger atômico anti-replay (somente laboratório)

A F39 verifica criptograficamente a assinatura e os pins de uma testemunha Ed25519. A F41 exige, após essa verificação, uma reserva única atômica por chave de testemunha e nonce. Repetições falham, erros de banco e respostas indefinidas falham fechados.

O adaptador `createSyntheticAtomicLedger` serve SOMENTE para processos Node de teste. O contrato `reserveOnce` de um banco real exige operação transacional atômica como `INSERT ... ON CONFLICT DO NOTHING` respaldada por índice UNIQUE `(witness_key_id, nonce)`, isolamento de organizações, credenciais mínimas, auditoria e política de retenção. O adaptador não é implementação de banco nem garante persistência entre processos/reinicializações.

Provas do teste: concorrência no mesmo processo, repetição, recibo inválido antes da reserva e indisponibilidade de storage. Nenhum deploy, testemunha remota, serviço pago, autorização de publicação, alteração de DNS ou main.

Execução: `node --test tests/atomic-receipt-ledger.test.mjs`.
