# Faísca R163 — observação conservadora após falha da conversa positiva

## Lacuna corrigida

A R162 demonstra que falhas HTTP 503 da Luna ou Terra deixam **uma** ou **duas** reservas de custo no ledger durável, respectivamente. O procedimento sequencial R161, entretanto, só comparava o ledger depois de uma resposta positiva bem-sucedida. Se a resposta falhasse, o relatório omitiria se houve reservas e poderia induzir o operador a repetir a operação sem conciliar o consumo.

A R163 agora executa uma **observação somente leitura do ledger** também após uma resposta positiva rejeitada, inválida ou uma falha de transporte do probe. Retorna somente `failedPositiveReservedRequests` com 0, 1 ou 2; caso não haja inspeção, retorna `null`. Isso representa **reservas locais desde a observação anterior**, nunca chamadas ou fatura reais do provedor. A leitura não é transacional e não identifica o processo que reservou.

Se houver alteração de cotas, rollback, reserva superior a duas, alteração de valores sem reserva, formato inesperado, lock ou falha de leitura, o resultado é **`BLOCKED_LEDGER_GATE`**, sem exceções. O estado `BLOCKED_POSITIVE_GATE` continua sendo falha mesmo quando o contador é 0, 1 ou 2, e `localLedgerDeltasVerified=false`, `ledgerReconciled=false`, `providerTransportVerified=false`, `publicReady=false` permanecem. **Não há retry, reembolso, redução de reserva ou liberação de atendimento público.**

## Provas sintéticas executáveis

```bash
node --test tests/faisca-r163-failed-positive-reservation-audit.test.mjs
node --test tests/faisca-r162-audited-provider-fixture-sequence.test.mjs
node --test tests/faisca-r161-private-ledger-sequence-proof.test.mjs
```

Os testes da R162 exercitam o adapter Luna/Terra de código real com `fetchImpl` totalmente simulado e validam uma reserva na falha Luna 503 e duas na falha Terra 503. A R163 inclui testes de deriva, rollback, limites, dados extras, estados falsamente reconciliados e ausência de alteração durável. A CI inclui Node, HTTP, Chromium/axe, auditoria editorial/API, Portal/Onepage, PHP e PostgreSQL descartável. São **fixtures**, não prova de uso real.

## Gate operacional preservado

O operador autorizado deve confrontar reservas locais, trilha privada de requisições e contagem/uso real do provedor **fora do GitHub** antes de qualquer repetição após falha. Não registrar credenciais, faturas nem dados de clientes. Não há acesso à VPS, implantação comprovada de R95–R163, chamada real à OpenAI, autorização de merge ou GO público nesta entrega.

A homologação R92 e o teste pago anterior permanecem respeitados. `main`, site público, mascote aprovado e `publicFaiscaEnabled=false` devem permanecer intactos; nenhum deploy, DNS, CRM, Portal operacional, lead, ticket ou cobrança é autorizado.
