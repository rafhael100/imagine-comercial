# Faísca R276 — revalidação após fence HTTP assíncrona (DRAFT)

## Falha reproduzida

R275 fixa a identidade de `assertPrivateHttpDeliverySafe`, `acknowledgeHttpDelivery` e
`markDeliveryUncertain` e valida a capacidade durável antes de chamar a fence.
Porém, a chamada `await lab.assertPrivateHttpDeliverySafe()` permite que outra
tarefa modifique o adaptador **durante a espera**. Mesmo quando a fence retorna
`true`, o estado pode ter mudado depois da última validação e antes do HTTP 200.
Não basta comprovar estabilidade **antes** de um `await`.

## Correção mínima e independente

- Usa a referência de fence capturada na inicialização quando o adaptador é durável.
- Após a verificação `true`, repete de modo síncrono os testes de identidade dos
  três hooks e de estabilidade da declaração `localDurableReservations`.
- Qualquer mudança provoca HTTP 503, liga o disjuntor NO-START da instância
  e persiste a incerteza pelo hook originalmente validado, sem confirmar entrega.
- Adaptações antigas não duráveis permanecem compatíveis e a verificação
  original de saída editorial continua obrigatória.

## Validação executável

```sh
node --test tests/faisca-r276-async-durable-fence-race.test.mjs
node --test tests/faisca-r275-pinned-durable-http-hooks.test.mjs
node --test tests/faisca-r274-durable-capability-drift.test.mjs
npm test
```

Cinco testes sintéticos: alterações de `acknowledgeHttpDelivery`,
`assertPrivateHttpDeliverySafe`, `markDeliveryUncertain`, retração da capacidade
durável **durante a espera assíncrona**, e caso positivo sem alteração.
Confere 403 sem autorização, 503 sem CORS/segredos, ausência de novas chamadas,
não confirmação de HTTP inseguro e persistência de NO-START no hook original.
Validar também Node/HTTP, Chromium/axe/WCAG, SEO/build, Portal/Onepage,
PostgreSQL efêmero e PHP nas seis workflows da HEAD final.

## Limitações / gates

A fence e a entrega pelo socket **continuam não atômicas** em cenários
distribuídos. Teste local e CI não provam imagem/PID/listener do staging na VPS
nem comprovam uso e despesa reconciliados externamente.
R92 e o teste pago Luna/Terra previamente relatados pelo operador
não foram repetidos. Não há dados reais, credenciais, OpenAI paga, CRM/Portal/Sites
operacional, deploy, merge, DNS ou alteração de VPS.
Continuam pendentes AppSec, LGPD, FinOps e revisão editorial independentes.

Preservar `main`, o site, o mascote aprovado e `publicFaiscaEnabled=false`.
**NO-GO público.**
