# Faísca R274 — identidade durável estável durante HTTP privado (DRAFT)

## Motivo

R271–R273 verificavam a existência da cerca e dos dois hooks de entrega
durável quando o listener era iniciado. Um adaptador injetado ainda podia
declarar `localDurableReservations: true` no bind e depois alterar essa
capacidade para `false` (ou fazer a alteração inversa). Nesse cenário,
a capacidade efetivamente anunciada ao longo do turno já não correspondia
ao contrato de segurança validado na abertura da porta.

## Incremento

- Captura o estado booleano da capacidade durável na inicialização, sem
  tornar o servidor público ou aceitar claims textuais.
- Reconsulta `lab.inspect()` antes de aceitar uma chamada ao provedor.
  Divergência, exceção ou indisponibilidade da inspeção bloqueia o turno
  com HTTP 503 genérico, sem iniciar a chamada.
- Reconsulta a mesma capacidade depois de validar a resposta editorial e
  antes da cerca final R270/R272 e do HTTP 200. Mutação durante o
  processamento mantém o bloqueio de novas requisições até revisão.
- Preserva o comportamento anterior quando a capacidade é estável, tanto
  no adaptador local durável quanto nos laboratórios sintéticos não duráveis.
- A nova verificação não torna atômico o intervalo entre a cerca
  `assertPrivateHttpDeliverySafe()` e a escrita no socket. A revisão
  AppSec e o vínculo da instância Docker/PID/porta continuam necessários.

## Testes executáveis

```sh
node --test tests/faisca-r274-durable-capability-drift.test.mjs
node --test tests/faisca-r273-durable-http-lifecycle-hooks.test.mjs
npm test
```

O novo teste HTTP faz duas mutações antes do despacho, uma mutação após
resposta sintética e um caso controle. Comprova 503, sem retry, sem eco
de tokens/perguntas, autenticação e CORS fechados. Não usa API OpenAI,
chaves, dados de cliente ou conexão ao Portal/Sites.

## Gates e situação

Branch empilhada em R273 #753, SHA
`a70689b2b60e68c66dd61350eabe313f9da58537`.
Validar as seis GitHub Actions **na HEAD exata** antes de considerar a
entrega pronta para revisão. Não supor que R95 esteja instalada na VPS:
homologação R92 e testes manuais pagos anteriores foram relatados,
não repetidos neste incremento. A homologação real exige evidência
independente da instalação Docker, processo e endpoints HTTP, além de
conciliação externa de consumo, revisão AppSec/LGPD/FinOps/editorial.

Sem merge, deploy, DNS, VPS, chamadas pagas, dados reais, CRM/Portal/Sites
operacionais, emissão de lead/ticket/cobrança. Preservar `main`, o
mascote aprovado, o site público e `publicFaiscaEnabled=false`.
**NO-GO público.**
