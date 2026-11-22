# Faísca R223 — ledger após falha no preflight negativo

## Lacuna corrigida

A sequência de homologação privada R157/R161 já conferia o ledger depois do
preflight negativo **bem-sucedido**, antes de iniciar a pergunta positiva.
Quando o próprio preflight negativo falhava — HTTP adulterado, recusa ou erro
de transporte — retornava `BLOCKED_NEGATIVE_GATE` sem uma segunda leitura do
ledger. Isso impedia reconhecer, no relatório, uma reserva indevida de
requisição/custo durante uma tentativa que deveria ter sido rejeitada sem
chamada ao provedor.

## Correção R223

`inspectFaiscaPrivateConversationSequence` agora observa o ledger também no
caminho de falha negativa, quando o inspetor local foi fornecido:

- Se o delta é exatamente zero e o snapshot é válido, conserva
  `BLOCKED_NEGATIVE_GATE`, sem pergunta positiva.
- Se houver reserva, mudança de limite, rollback, snapshot inválido ou falha
  de leitura, retorna `BLOCKED_LEDGER_GATE`, sem pergunta positiva, retry,
  reembolso automático ou declaração de consumo do provedor.
- Na ausência do inspetor opcional, conserva a falha negativa anterior;
  **não** declara ausência de gastos nem faturamento comprovado.

O teste `tests/faisca-r223-negative-ledger-failclosed.test.mjs` usa HTTP
loopback real e fixtures de ledger: resposta 200 negativa falsificada com
reserva, sem reserva, inspetor indisponível e erro de transporte. Confere
ausência de mensagem positiva, ausência de modelo, redacção de dados
sintéticos e flags `publicReady=false`/`operationalEffects=false`.

## Como reproduzir no checkout isolado

```bash
node --test tests/faisca-r223-negative-ledger-failclosed.test.mjs
node --test tests/faisca-r157-private-staging-sequence.test.mjs tests/faisca-r161-private-ledger-sequence-proof.test.mjs tests/faisca-r163-failed-positive-reservation-audit.test.mjs
```

A CI `faisca-guided-lab.yml` executa `tests/faisca-*.test.mjs` e a suíte
Chromium/axe/HTTP existente. Os testes não usam chaves reais nem serviço
OpenAI pago. A homologação operacional cumulativa em staging continua
dependente de checkout e SHA verificados pelo operador; não inferir
instalação da R95 ou das entregas seguintes na VPS.

**NO-GO público:** sem merge, deploy, DNS, alteração de VPS, dados reais,
chamadas CRM/Portal/Sites, cobrança, lead ou ticket. Preservar main, mascote,
site público e `publicFaiscaEnabled=false`.
