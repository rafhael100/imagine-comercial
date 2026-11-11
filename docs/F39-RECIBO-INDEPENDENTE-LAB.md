# F39 — Recibo de entrega independente (somente laboratório)

## Objetivo
Adicionar um verificador isolado de recibo Ed25519 de um *witness* independente do emissor Portal. O recibo contém releaseId, alvo (staging/production), SHA-256 da árvore, chave do witness, timestamp em segundos e nonce. Todos os campos são assinados em uma codificação canônica e comparados com pins **obtidos separadamente do recibo**.

## Limites de segurança
- O emissor de catálogo Portal e o witness devem possuir identidades de chave distintas.
- O verificador requer chaves públicas previamente confiáveis, relógio confiável e Set de nonces; o Set é somente um mock em memória.
- O recibo é válido por até cinco minutos, sem tolerância a relógio futuro.
- Não há chamadas HTTP, credenciais, upload, controle remoto, armazenamento durável, confirmação de arquivos em destino ou autorização de deploy neste recorte.
- Um witness de produção deverá ser independente do runner, verificar os bytes após a entrega e emitir recibo autenticado; exigir persistência transacional do ledger anti-replay, MFA/grants, autorização editorial e aprovação humana.
- Não aceitar um recibo criado pelo mesmo processo que produziu o pacote como prova independente.

## Verificação
`node --test tests/independent-delivery-receipt.test.mjs` e CI normal do repositório. Casos sintéticos: sucesso, adulteração, chave incorreta, mudança de release/alvo/tree, expiração e replay.

**REVIEW ONLY:** este módulo isolado não integra a CLI de publicação nem autoriza release, merge, DNS ou deploy.
