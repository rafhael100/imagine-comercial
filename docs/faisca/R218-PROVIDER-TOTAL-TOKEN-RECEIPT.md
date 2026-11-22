# R218 — total_tokens do provedor e reconciliação conservadora

## Problema
A resposta da API OpenAI pode incluir `usage.input_tokens`, `usage.output_tokens` e `usage.total_tokens`. O adaptador já validava os contadores individuais e os limites reservados, mas ignorava um `total_tokens` opcional. Um recibo internamente contraditório ainda podia ser interpretado como resposta concluída, sem revisão humana.

## Correção
Quando o campo `total_tokens` estiver presente, exigir inteiro seguro igual a `input_tokens + output_tokens`. Recusar valores nulos, fracionários, negativos, divergentes e somas não representáveis; o campo ausente continua aceito para compatibilidade de fixtures anteriores. Essa verificação acontece antes da conclusão da requisição; um recibo inconsistente mantém o circuito fechado, a marca durável de resultado incerto e a reserva, sem devolução, repetição ou segunda chamada.

## Evidência sintética
`tests/faisca-r218-provider-total-token-receipt.test.mjs` cria ledger local fsynced temporário e servidor HTTP em loopback. Exercita divergência mínima em Luna, campo malformado em Luna, divergência em Terra, recibos coerentes e compatibilidade sem campo total. Nos cenários rejeitados valida HTTP 503 genérico sem vazamento, bloqueio após reinício e ausência de novos despachos. Nenhum token ou dado operacional real é usado.

## Limitações e gates
A igualdade é apenas uma verificação de **consistência interna do recibo declarado** pelo provedor. Ela não comprova faturamento, preço efetivo ou confiabilidade do próprio provedor: conciliação independente, revisão FinOps/AppSec/LGPD/editorial e homologação acumulada em staging privado ainda são obrigatórias. O local ledger não representa limite transacional distribuído nem prova de entrega no browser.

**Não autoriza:** merge, deploy, alteração de main/VPS/DNS, produção, Portal/CRM/Sites operacional, cobrança, lead, ticket ou atendimento público. `publicFaiscaEnabled=false` permanece intocado. Os testes pagos anteriores e a homologação R92 informada pelo operador não são repetidos.
