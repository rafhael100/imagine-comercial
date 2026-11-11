# F44 — Política de janela ativa de chave do witness (laboratório)

O wrapper F44 acrescenta à F39/F41 a verificação fail-closed de identidade do witness, estado `active/revoked/suspended` e janela de validade `[validFrom, validUntil)`. Antes de reservar um nonce, exige chave ativa, recibo emitido na janela e relógio atual dentro dela. Em seguida executa o verificador real de assinatura F39 e o contrato de reserva atômica F41.

**A fonte da política deve ser confiável e independente**, autenticada e fresca em uma futura operação. Uma política arbitrária fornecida por um cliente não prova confiança; esta versão não fornece distribuição de chaves, revogação remota, prova de entrega, banco durável ou deployment.

Todos os testes usam pares Ed25519 efêmeros e ledger sintético. A CLI, Cloudflare, DNS, produção e `main` não são modificados. Não associar esta implementação a aprovação de produção.

Teste: `node --test tests/witness-trust-window.test.mjs`.
