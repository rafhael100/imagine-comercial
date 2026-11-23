# Faísca R278 — ACK de entrega HTTP durável deve confirmar sucesso

**Base imutável revisada:** R277 #757, HEAD `f45d44969d0c2d3342efd42087b21e58ac6b05d2`.

## Falha corrigida

O servidor privado aguardava a Promise de `acknowledgeHttpDelivery()`, mas considerava **qualquer resolução**, inclusive `false`, `null` ou `undefined`, uma liberação do marcador durável. Um adaptador com erro de implementação poderia permitir nova requisição em memória depois de uma tentativa de ACK não confirmada.

A R278 passa a exigir retorno **estritamente `true`** quando o adaptador declara `localDurableReservations: true`. Qualquer outro resultado conserva a resposta já enviada (não é possível desfazer bytes entregues), dispara o bloqueio local `providerUnavailable`, solicita o marcador NO-START via hook original pinado e impede qualquer novo despacho no processo. Lançamentos/rejeições continuam falhando de forma conservadora. O servidor nunca repete ou reembolsa uma reserva incerta.

O adaptador real `live-lab` passa a retornar `true` somente como **ACK no-op** para resposta editorial fixa quando não há chamada paga pendente, nem marcador de despacho retido, nem incerteza. Respostas com chamada paga ainda dependem da conclusão real do ledger. Isso impede que uma conversa editorial legítima seja incorretamente travada após a mudança de contrato.

## Testes

```sh
node --test tests/faisca-r278-durable-http-ack-result.test.mjs
node --test tests/faisca-r263-private-http-durable-ledger.test.mjs tests/faisca-r277-private-conversation-late-fence-ledger.test.mjs
npm test
npm ci --no-audit --no-fund
npm run build
npm run test:browser
```

O teste R278 executa HTTP autenticado em `127.0.0.1`, recusa 403 anônimo, simula ACK `false`, `undefined` e `null`, exige 503 e impossibilidade de nova chamada, valida ACK `true` e duas respostas editoriais R95 sem transporte OpenAI ou gasto. Testa limpeza dos marcadores, ausência de CORS e não divulgação de mensagens/segredos sintéticos. GitHub Actions também executa Node/HTTP, Chromium/axe/WCAG, Astro/SEO, Onepage, PostgreSQL e PHP.

## Limites e gates

O evento HTTP `finish` confirma escrita local, **não** recebimento ou leitura pelo operador. A checagem do marcador, os bytes no socket e o ACK não formam uma transação atômica entre processos. Um crash antes do fsync do marcador de incerteza ainda requer revisão humana, evidência externa independente e reconciliação de uso.

R92 e o teste pago manual Luna/Terra informados pelo operador não são repetidos. R95 ou R278 não foram comprovadas na VPS. **Não** usar chaves ou dados reais, executar deploy/merge, tocar em DNS, CRM, Portal ou Sites, nem liberar atendimento público. `main`, a identidade visual, o mascote e `publicFaiscaEnabled=false` continuam preservados.

**Estado: DRAFT / LAB / NO-GO público.** Revisões AppSec, LGPD, FinOps e editorial e prova Docker/PID/HTTP em staging são gates independentes.
