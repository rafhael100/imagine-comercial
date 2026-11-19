# F45 — Política de witness assinada por raiz independente

O recorte F44 aceitava uma política de chave como dado confiável do orquestrador. A F45 adiciona a verificação Ed25519 desta política antes de aplicar o controle F44, a assinatura do recibo F39 e a reserva anti-replay F41.

A assinatura cobre a identidade da raiz, um número de sequência monotônico e os campos imutáveis da política (witness, chave pública, estado, início e fim de validade). A raiz confiável e o `minSequence` devem ser obtidos por um **canal confiável independente**. Isso impede substituição de chave e rollback quando o orquestrador realmente fornece uma sequência monotônica fresca.

O teste usa apenas chaves temporárias e ledger em memória. Não implementa infraestrutura de distribuição de raízes, armazenamento durável de sequência, revogação online, entrega real, DNS nem deploy.

Verificar com `node --test tests/signed-witness-trust-policy.test.mjs`. Este é um contrato de laboratório e nunca deve habilitar publicação automática.
