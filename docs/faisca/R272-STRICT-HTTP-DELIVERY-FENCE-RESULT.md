# Faísca R272 — resultado positivo obrigatório da cerca HTTP (DRAFT)

## Motivo

R270 #750 introduziu a última conferência do marcador durável antes da resposta HTTP. R271 #751 passou a exigir a presença desse método quando o adaptador declara reservas duráveis. Porém, o servidor aguardava a Promise sem conferir o **valor de retorno**. Um adaptador que retornasse `false`, `undefined` ou `null` sem lançar exceção continuaria liberando HTTP 200, apesar de não afirmar que a cerca está segura.

## Correção

A rota privada agora só considera o resultado seguro quando `await lab.assertPrivateHttpDeliverySafe() === true`. Qualquer resultado diferente é tratado como falha, devolve HTTP **503** genérico e ativa o mecanismo de incerteza para impedir nova chamada Luna/Terra no processo. As reservas já efetuadas não são reembolsadas, não há retry, e os marcadores duráveis ficam até revisão.

Isso preserva o caso positivo do adaptador real e não altera a interface nem a exposição pública. Adapters não duráveis sem esse método mantêm a compatibilidade sintética existente; duráveis sem método continuam impedidos de abrir a porta pela R271.

## Regressão executável

```sh
node --test tests/faisca-r272-strict-http-delivery-fence-result.test.mjs
npm test
```

A regressão cria um ledger local descartável, faz duas chamadas **simuladas** Luna/Terra pelo servidor HTTP R95 verdadeiro em loopback, verifica 200 somente no caso `true` e 503 para `false`, `undefined` e `null`. Exige token do operador, ausência de CORS, `no-store`, nenhuma terceira chamada, duas reservas preservadas e nenhum texto ou credencial fictícia no ledger. Executar CI da SHA exata: Chromium/axe/WCAG, Node/HTTP, SEO/build, Portal/Onepage, PostgreSQL descartável e PHP.

## Limitações e critérios de saída

A exigência de `true` ainda depende do adaptador injetado: não é prova criptográfica independente da cerca nem garantia de que o marcador e o primeiro byte HTTP sejam atômicos. O evento `finish` continua sem comprovar leitura da resposta pelo operador. A instalação R95–R272 na VPS, a identidade Docker/PID/socket/resposta, a conciliação externa de gastos OpenAI e as revisões AppSec/LGPD/FinOps/editorial exigem evidência própria.

R92 e os testes reais Luna/Terra manuais já relatados não foram repetidos. Não houve chave, chamada paga, dado real, ação CRM/Portal/Sites, merge, deploy ou alteração DNS/VPS. `main`, mascote, site público e `publicFaiscaEnabled=false` permanecem intactos. **NO-GO público.**
