# Faísca R275 — identidade dos hooks duráveis no HTTP privado

## Problema

R273 exigia três funções no adaptador durável antes de abrir a porta,
mas uma referência de função poderia ser substituída após o bind.
A rechecagem de tipo detecta funções removidas, não uma função diferente
que pode relatar segurança ou confirmação indevidas.

## Alterações

- Captura as três referências exatas (`assertPrivateHttpDeliverySafe`,
  `acknowledgeHttpDelivery`, `markDeliveryUncertain`) quando o servidor
  privado é inicializado.
- Se qualquer referência mudar antes da resposta, não emite HTTP 200.
  Retorna HTTP 503 e bloqueia novos turnos até revisão.
- Preserva a referência originalmente validada de
  `markDeliveryUncertain` para persistir NO-START quando uma função foi
  retirada ou substituída. Preserva também a referência de
  `acknowledgeHttpDelivery` para a confirmação de escrita no evento
  `finish`; nunca chama uma função arbitrária injetada depois do bind.
- Mantém compatibilidade com adaptadores não duráveis usados por fixtures.
  A inspeção estrita R274 permanece um gate independente.

## Validação local e CI

```sh
node --test tests/faisca-r275-pinned-durable-http-hooks.test.mjs
node --test tests/faisca-r274-durable-capability-drift.test.mjs
node --test tests/faisca-r273-durable-http-lifecycle-hooks.test.mjs
npm test
```

Os testes usam HTTP em loopback e respostas sintéticas. Verificam a
substituição de cada hook após bind e durante um turno, HTTP 503
sem vazamento, inexistência de retry, sinalização via função originalmente
validada, autenticação e caso estável com HTTP 200 e confirmação.
Validar Chromium/axe/WCAG, Node/HTTP, SEO/build, PHP, PostgreSQL
descartável e Portal/Onepage **na HEAD exata**.

Esta defesa não torna a verificação final e a entrega do socket atômicas,
nem comprova a instalação R95 na VPS. R92 e o teste pago real manual
relatados pelo operador não foram repetidos. Exigir evidence Docker/PID/HTTP,
conciliação de uso externa, AppSec/LGPD/FinOps/editorial antes de qualquer
decisão operacional. Sem dados reais, credenciais, chamadas pagas, merge,
deploy, alteração de VPS/DNS ou uso operacional CRM/Portal/Sites.
Preservar `main`, mascote, site público e
`publicFaiscaEnabled=false`. **NO-GO público.**
