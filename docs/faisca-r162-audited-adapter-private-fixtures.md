# Faísca R162 — prova integrada do gate R161 com o adapter Luna/Terra

A R161 conferiu os deltas de um ledger durável no servidor privado,
mas a simulação da resposta positiva era feita por um stub da aplicação.
A R162 exercita também o **adapter real de código**
`createFaiscaOpenAILiveLab`, seu cliente de Responses API, o servidor HTTP
de loopback, as provas de integridade de ativos e as reservas locais R145/R160.

`tests/faisca-r162-audited-provider-fixture-sequence.test.mjs` verifica:
- o POST negativo rejeitado não reserva orçamento e não chega ao adapter de API;
- a etapa positiva passa pelo adapter Luna/Terra, gera duas tentativas
  `POST /v1/responses` simuladas, `store:false`, `tools:[]` e
  `tool_choice:none`, com duas reservas persistentes verificadas na R160;
- falha HTTP 503 sintética da Luna deixa **uma** reserva e status
  `BLOCKED_POSITIVE_GATE`; da Terra deixa **duas** reservas com o mesmo
  bloqueio. Não há tentativa automática de retry;
- nenhum identificador de teste, conteúdo da resposta, segredo fictício
  ou endpoint de API é copiado ao relatório operacional.

## Executar em ambiente de testes

```bash
node --test tests/faisca-r161-private-ledger-sequence-proof.test.mjs
node --test tests/faisca-r162-audited-provider-fixture-sequence.test.mjs
node --test tests/faisca-r158-durable-model-sequence.test.mjs
```

As requisições à API são interceptadas exclusivamente pelo `fetchImpl`
do fixture; **não há credencial válida, chamadas reais à OpenAI,
consumo pago, requisição externa ou VPS envolvida**. O adapter é código
real, o transporte de provedor é inteiramente sintético.

A CI verde confirma somente o laboratório. Mesmo
`localLedgerDeltasVerified=true` não prova que o provedor foi
acionado ou faturou; as flags `ledgerReconciled=false`,
`providerTransportVerified=false` e `publicReady=false`
permanecem. Com falha de Luna/Terra o consumo estimado fica
deliberadamente reservado e a análise humana deve verificar o uso
real antes de repetir qualquer operação.

Homologação anterior de R92 e testes pagos anteriores não devem ser
repetidos sem motivo. R95–R162 não têm instalação comprovada em VPS.
Revisão AppSec/LGPD/FinOps/editorial e conciliação externa continuam
gates. Sem merge, deploy, alterações DNS/VPS, credenciais ou dados reais;
`main`, mascote, site público e `publicFaiscaEnabled=false`
seguem intactos. Sem GO público.
