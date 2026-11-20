# Faísca R105 — timeout absoluto da API privada, mesmo se fetch/stream ignorar AbortSignal

**Base:** R104 #579 HEAD `011d50d1c391ac7f14cdae1ad19d94cad7b7257d`; não há merge, deploy nem execução em VPS.

## Falha e proteção

O cliente Luna/Terra criava `AbortController` com `timeoutMs`, mas aguardava diretamente `fetchImpl()` e `reader.read()`. Se um adaptador injetado, proxy ou stream malformado ignorasse o sinal, qualquer uma dessas promises poderia permanecer pendente sem limite mesmo após `controller.abort()`. O `reader.cancel()` aguardado no `finally` também poderia ficar suspenso indefinidamente. O processo de laboratório, já com reserva durável consumida, ficaria preso.

A função `awaitAbortable()` disputa a promise original com uma rejeição no evento abort; remove o listener em sucesso ou falha. O cliente usa essa camada tanto no `fetchImpl` como em cada `reader.read()`. A limpeza da stream tenta `cancel()`, sem aguardar promise de cancelamento que não coopere. O abort continua agindo normalmente no transporte nativo. Não há retries nem reembolso de reserva sob resposta incerta. Não promete cancelar efeitos que um transporte deliberadamente ignore; garante **que a operação aguardada pelo cliente deixe de ficar presa**.

## Provas executáveis

`node --test tests/faisca-r105-private-api-abort-deadline.test.mjs`

Fixtures sem rede real simulam (1) fetch que nunca resolve, (2) resposta HTTP 200 com stream cujo read/cancel nunca resolve, (3) resposta JSON válida de Luna escolhendo `none`. Os dois primeiros terminam pelo timeout de um segundo, com uma única reserva e sem Terra/retry. O terceiro mantém a funcionalidade normal. Rodar CI completa Node/HTTP/Chromium/axe, PHP, PG descartável, Onepage/Portal e SEO na HEAD exata.

## Limites e gates

A reserva R82–R100 é estimativa local single-host, não garante bloqueio de faturamento oficial em OpenAI ou processamento remoto cancelado. Homologação privada após revisão AppSec/concor­rência/editorial independente somente por operador autorizado com SHA e ledger existente; a homologação manual R92 não demonstra instalação R95–R105. Publicação exige Portal autenticado com autoridade empresarial, contrato, aceite, recibos e GO humano separado.

Permanecem `publicFaiscaEnabled=false`, mascote e site público aprovados, `main` intacta, sem dados reais, credenciais, chamadas pagas, VPS/DNS, deploy, integrações operacionais, leads, tickets ou cobrança.
