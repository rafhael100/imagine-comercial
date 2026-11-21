# Faísca R175 — testemunho independente de revisão numérica (somente laboratório)

Estado: **DRAFT / NO-GO público**. Base: R174 #652, HEAD inicial `24a88231049a5193076e4d62943916cf2731f4b5`.

## Risco mitigado

A R167–R174 compara três extratos numéricos locais (antes, depois e agregado separado) com SHA-256 independente. Ela **não** associa automaticamente a revisão de um humano independente à HEAD, janela temporal e execução específica. R175 adiciona um verificador **Ed25519** de testemunho humano com escopo estrito, sem transmitir ou armazenar prompts, modelos, chaves, PII, URLs ou faturas.

O assinante revisa os três digests e a origem por um canal privado **independente**, verificando os números diretamente no painel/exportação sob sua própria autoridade. O JSON assinado contém apenas `schema, source, headSha, outcome, nonce, pins, reviewedAt, expiresAt, publicReady, operationalEffects`. O conteúdo é assinado como `Buffer.from(JSON.stringify(statement) + '\n', 'utf8')`. Use uma chave Ed25519 de revisão separada das chaves de API, identidades da VPS e chaves de produção. Somente a chave **pública** do revisor deve ser provida ao verificador por canal independente; não inclua chaves privadas em GitHub, logs ou CI.

O verificador `verifyFaiscaIndependentNumericReview` exige:
- HEAD SHA de 40 hex, nonce único de 32 hex e resultado esperado recebidos separadamente;
- três pins SHA-256 em minúsculas recebidos por canal independente, iguais aos do testemunho;
- assinatura Ed25519 válida sobre declaração estritamente tipada e sem campos extras;
- revisão temporal válida (não mais de 24h atrás), tolerância de cinco minutos de relógio e expiração de até quatro horas;
- `source=operator_manual_numeric_provider_comparison_not_provider_attested`, `publicReady=false` e `operationalEffects=false`.

## Limites e homologação

**Assinatura do revisor não é assinatura da OpenAI.** Ela prova somente que a chave privada do revisor assinou exatamente a afirmação. Não prova que houve leitura real do painel, fonte independente legítima, valores de faturamento, ausência de replays ou autorização de publicação. Um nonce deve ser gerado e marcado como consumido pelo operador em registro independente, não derivado dos próprios arquivos. A verificação pura não gerencia esse registro nem usa rede.

Teste sintético: `node --test tests/faisca-r175-independent-review-witness.test.mjs`. Chave de teste efêmera; sem chamadas pagas, acesso à VPS, dados reais, migração, merge, deploy, DNS, CRM/Portal, lead ou cobrança. O próximo incremento integra a verificação ao procedimento do operador sem transformar um resultado numérico compatível em GO.

Preservar `publicFaiscaEnabled=false`, `main`, mascote aprovado e site público. O teste manual R92 e as chamadas pagas Luna/Terra anteriores não são repetidos.
