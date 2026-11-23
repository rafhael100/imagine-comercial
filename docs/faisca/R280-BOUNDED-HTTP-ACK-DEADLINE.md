# R280 — Prazo absoluto para ACK HTTP durável

**Base revisada:** R279 #759, HEAD `e6e5005ee67cf3547a8bc4c0ab4c73ae97f57c14`.

## Problema

Depois de terminar a escrita HTTP, o servidor aguardava `acknowledgeHttpDelivery()` para liberar a próxima requisição. O hook é injetado e pode nunca resolver. Nesse caso, qualquer solicitação posterior ficava aguardando sem prazo na fila `deliveryAck`, sem erro 503 nem registro da incerteza. O resultado é DoS do laboratório e um estado de entrega ambíguo.

## Correção

O ACK agora tem deadline absoluto configurado no bind por `deliveryAckDeadlineMs`, com valor padrão 3000 ms e faixa validada de 50–30000 ms. Um timeout/rejeição/retorno diferente de `true` para adaptador durável causa latch local `providerUnavailable` e sinaliza NO-START via o hook original. Não há retry nem reembolso. A Promise do ACK não é cancelada; se o adaptador concluir depois, **não** pode reabrir o servidor. Persistência efetiva do marcador após erro de armazenamento permanece um gate operacional independente.

## Testes

```sh
node --test tests/faisca-r280-bounded-http-ack.test.mjs
node --test tests/faisca-r278-durable-http-ack-result.test.mjs tests/faisca-r279-durable-http-ack-negative-restart.test.mjs
npm test
```

O teste usa HTTP real em `127.0.0.1`, adaptadores sintéticos com ACK nunca resolvido, ACK tardio e ACK positivo, checa 403 sem autenticação, 503 depois do deadline, ausência de eco/PII e limites de configuração. Regressões R278/R279 exercitam retorno negativo e ledger real. CI cobre Node/HTTP, Chromium/axe/WCAG, Astro/SEO, Onepage, PostgreSQL efêmero e PHP.

## Restrições

O deadline limita espera HTTP, mas **não** torna atômicos o fsync da reserva, o envio do socket e a liberação do marcador entre processos. Um ACK remoto atrasado pode executar efeitos depois do timeout: persistir NO-START, auditar e reconciliar antes de qualquer reinício operacional.

Somente laboratório privado, perguntas fictícias, sem credenciais reais ou API paga. Não instalar na VPS, alterar DNS, operar CRM/Portal/Sites, publicar, fazer merge ou alterar `main`. Mascote, site e `publicFaiscaEnabled=false` preservados. R92 e testes pagos manuais anteriores não repetidos. Revisões AppSec/LGPD/FinOps/editorial e prova Docker/PID/HTTP de staging continuam pendentes.

**DRAFT / NO-GO público.**
