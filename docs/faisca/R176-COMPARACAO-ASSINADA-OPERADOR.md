# Faísca R176 — conferência assinada no procedimento de auditoria offline

**Status: DRAFT, laboratório privado, NO-GO público.** Base R175 #653. Sem acesso à VPS ou chaves OpenAI.

A CLI `scripts/faisca-private-provider-offline-audit.mjs` continua a exigir HEAD revisada externamente, três pins SHA-256 independentes, diretório privado e `YES_OFFLINE_NUMERIC_REVIEW_ONLY`. Agora aceita, **opcionalmente**, um conjunto completo de três entradas independentes:

- `FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_WITNESS_JSON`: declaração R175 assinada Ed25519 por revisor humano, com números exclusivamente sintéticos em CI;
- `FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_PUBKEY_PEM`: chave pública do revisor, conferida por canal diferente do testemunho;
- `FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE`: nonce de 32 hex em registro independente de uso único, não derivado do JSON.

Nenhuma dessas variáveis é credencial OpenAI. O material **não** deve ser registrado em PR pública, CI artifact ou logs. A aplicação não gera chaves, nem assina testemunhos ou consulta OpenAI. No laboratório, somente chaves efêmeras sintéticas são utilizadas.

**Comportamento fail-closed:** se qualquer uma das três entradas estiver presente, as três se tornam obrigatórias. Assinatura inválida, campo extra, reviewer key diferente, nonce divergente, HEAD ou pins distintos, resultado errado, testemunho expirado ou material excessivo impedem a leitura das evidências. Nenhum erro reproduz material sensível ou caminhos.

Sem testemunho, a auditoria numérica legada mantém resultado explicitamente `independentReviewWitnessVerified=false`. Se o testemunho for validado, este campo será `true`, mas o estado da auditoria permanece `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW` no caso favorável; saída com **código 2**, jamais GO. Uma assinatura humana comprova a assinatura da declaração, **não** a autenticidade dos números OpenAI, a origem dos arquivos, o pagamento efetivo ou a segurança do servidor. Não existe controle durável de nonce aqui; o custodiante deve impedir replay por registro independente e nunca reutilizar o testemunho.

Testes: `node --test tests/faisca-r175-independent-review-witness.test.mjs tests/faisca-r176-private-operator-witness-cli.test.mjs` + CI completa Node/Chromium/axe/HTTP, compatibilidade Portal/Onepage, PHP/PG e SEO/build.

Os testes pagos Luna/Terra e a homologação R92 anteriores foram respeitados. Nada é implantado. Permanecem pendentes R95+ em staging privado, revisão AppSec/LGPD/FinOps/editorial e confronto independente com o provedor. `main`, o site, o mascote e `publicFaiscaEnabled=false` seguem inalterados.
