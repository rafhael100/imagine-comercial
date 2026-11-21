# Faísca R158 — prova integrada da sequência e do ledger local com API simulada

## Hipótese testada

A R157 encadeia os dois testes HTTP, mas o envelope de modelos não prova consumo nem reserva. A R158 adiciona uma prova de laboratório com o adaptador real Luna/Terra, duas respostas da Responses API completamente simuladas e o ledger R145 de host único, armazenado em diretório temporário 0700.

O teste passa pelo servidor HTTP real em loopback e pelo gate negativo→positivo da R157. Ao começar os ativos da etapa positiva, confere que a pergunta negativa não causou nenhuma requisição fictícia ao provedor e que não existe arquivo de reserva. Na etapa positiva, verifica modelo Luna seguido de Terra, payload store:false, tools:[], ausência de retry, duas reservas persistentes e high-water witness com mesmos contadores. Uma terceira reserva é recusada.

Dois cenários de erro isolados fazem Luna ou Terra responder HTTP 503: o gate não libera conversa, não reenvia requisições e preserva cada reserva local consumida. Tokens, perguntas, respostas e dados de clientes não são escritos no ledger, logs ou relatório.

## Executar em CI/laboratório

```bash
node --test tests/faisca-r158-durable-model-sequence.test.mjs
```

Os testes usam chaves apenas sintáticas e nunca realizam conexões com api.openai.com; o transporte injetado retorna fixtures locais e afirma o contrato HTTP antes da resposta. Sem criação ou migração de banco persistente, sem acesso à VPS.

## Limites e gates

Este ensaio demonstra contabilização **dentro da fixture e no host descartável**. Não certifica faturamento OpenAI, dois modelos efetivamente processados, ausência de chamadas clandestinas, retenção em hosts múltiplos, perda elétrica real ou contas do staging. R92 e os testes pagos manuais anteriores permanecem aceitos, não repetidos. Operador autorizado deve executar o R157 no staging, com revisão da SHA e reconciliação independente dos registros do provedor/ledger.

Revisão AppSec/LGPD/FinOps/editorial e a homologação privada acumulada continuam necessárias. Sem alteração de main, mascote, site público, publicFaiscaEnabled=false, VPS/DNS, CRM, Portal, Sites, checkout, pagamentos, leads ou tickets. Não é GO público.