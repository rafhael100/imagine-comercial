# R342 — entrega acumulada para homologação privada (24/11/2026)

**REVIEW ONLY / NO-GO público.** A R92 já foi relatada como homologada pelo operador. Não repetir essa versão nem presumir a instalação da R95 ou de qualquer descendente. O objetivo agora é uma única homologação da cadeia acumulada com evidências separadas para HTTP, navegador, ledger local e cobrança do provedor.

## Seleção de revisão
- R95 #570: `91951653fca999f26595cc8113fbaff151225a89` — [6/6 CI](https://github.com/rafhael100/imagine-comercial/actions/runs/44656914085).
- R340 #821: `84f139c13cef53210d639669ee7338eb0f9fc349` — [CI de jornada privada, Chromium, axe e build](https://github.com/rafhael100/imagine-comercial/actions/runs/45460500059) e outros cinco workflows aprovados. Fixtures apenas.
- R341 #822: `0aee338799671bd774575d5e35f09759f5a10a79` — acrescenta readiness do observador antes do negativo e antes do positivo; [CI 6/6](https://github.com/rafhael100/imagine-comercial/actions/runs/45471164078) aprovada em 24/11/2026. Revisão independente permanece obrigatória.

- R344 #825: `87d799f3d727bf2340b0bd4f562575418ef4b285` — [CI 6/6](https://github.com/rafhael100/imagine-comercial/actions/runs/45481925931) aprovada em 24/11/2026, incluindo encerramento HTTP com ledger persistente e upstream simulado. É candidata acumulada para revisão independente, não aprovação operacional.

- R346 #827: `aac917dc6df27dde6ef016f9ed31acded6117dde` — [CI 6/6](https://github.com/rafhael100/imagine-comercial/actions/runs/45492022700) aprovada, incluindo encerramento com sinais em subprocessos descartáveis. Candidata acumulada à revisão independente; não homologada na VPS.

Escolher uma única HEAD completa de revisão, após CI na SHA exata e revisão AppSec, LGPD, FinOps e editorial. Receber o pin por canal confiável independente; não usar o próprio HEAD como origem do pin. A SHA de R342 também precisa de CI se selecionada. O documento não concede autorização de infraestrutura, nem é evidência de operação.

## Operador autorizado — sem alteração de produção
Preservar checkout, contêineres e estado R92. Usar checkout isolado e limpo da revisão escolhida, Node >=22.12 e dependências reproduzíveis. Não sobrescrever estado, iniciar segundo serviço concorrente, liberar porta externa, fazer merge, trocar DNS nem remover fences/locks. Confirmar que a sessão privada já provisionada tem os valores esperados pelo servidor:
- `FAISCA_PRIVATE_LEDGER_DIR`: diretório local privado existente e preservado (0700), sem compartilhamento com outros serviços.
- `FAISCA_STAGING_REVIEW_SHA`: pin completo revisado externamente.
- `IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY` e `FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY`.
- Chave OpenAI e bearer de revisão independentes, provisionados pelo custodiante; não usar arquivos ou canais públicos, argumentos de linha de comando, logs, screenshots ou GitHub para transmitir segredos.

No shell privado provisionado, após aprovação operacional explícita:

```sh
node scripts/faisca-private-staging-preflight.mjs "$FAISCA_STAGING_REVIEW_SHA"
# Exigir READY_FOR_PRIVATE_OPERATOR_START antes de iniciar.
node scripts/faisca-openai-private-review-server.mjs
```

Servidor apenas em 127.0.0.1:4336. Se houver NO-START, parar; não limpar, recriar ou substituir ledger para forçar GO.

## Observador independente: sem chave OpenAI

Outra sessão local privada, mesmo checkout limpo/pin, sem chave do provedor. Em revisão que incorpore R347 #828, `OPENAI_API_KEY` deve estar ausente (não apenas vazia); o observador reutiliza a evidência Git isolada da preflight e rejeita arquivos privados extras. O custodiante fornece apenas o bearer privado e o caminho EXATO do ledger existente. A variável do observador é `FAISCA_PRIVATE_LEDGER_DIRECTORY` (não `FAISCA_PRIVATE_LEDGER_DIR`). Na R340/R341 o entrypoint fixa 100 requisições e USD 10 de reserva estimada local; o observador deve usar os mesmos valores, não limites inventados ou um novo diretório.

Primeiro, smoke de leitura sem chamada paga:

```sh
export FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY
node scripts/faisca-private-staging-readonly-smoke.mjs
# Exigir PRIVATE_UI_READONLY_VERIFIED.
```

Somente após smoke e autorização do operador, uma única sequência: rejeição de privacidade fictícia + pergunta geral fictícia positiva; até duas chamadas de modelo, sem retry.

```sh
export FAISCA_PRIVATE_LEDGER_MAX_REQUESTS=100
export FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD=10
export FAISCA_PRIVATE_SEQUENCE_ACK=YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS
export FAISCA_PRIVATE_LEDGER_AUDIT_ACK=YES_LOCAL_READONLY_NO_PROVIDER_PROOF
node scripts/faisca-private-staging-sequence.mjs "$FAISCA_STAGING_REVIEW_SHA"
```

O resultado esperado é `PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED` e `localLedgerDeltasVerified: true`. Negativo: zero reservas; positivo: duas reservas locais. Os campos `ledgerReconciled`, `providerTransportVerified` e `publicReady` permanecem falsos por desenho. Se falhar ou a saída for incerta, não repetir automaticamente nem remover qualquer marcador. Registrar somente status e contagens; parar para conciliação do custodiante.

## Evidência de aceitação complementar
- Interface: túnel SSH local autorizado (sem publicar porta), navegador em `http://127.0.0.1:4336/__faisca_openai_private/review`. Testar separadamente, quando autorizado, uma pergunta fictícia geral; exigir resposta segura, sem dados de clientes, sem ação externa e sem alegação de acesso ao Portal/CRM/Sites. Essa interação pode consumir créditos adicionais, não faz parte das duas chamadas da sequência.
- Encerrar o serviço normalmente e aguardar o drain/ACK antes de inspeção final. Em revisão que incorpore R343 #824, exigir `PRIVATE_SHUTDOWN_LOCAL_DRAIN_VERIFIED` e exit 0. `PRIVATE_SHUTDOWN_RECONCILIATION_REQUIRED`, exit diferente de zero ou ausência de confirmação não constituem encerramento verificado; não iniciar novamente nem remover marcadores. A confirmação é local, não prova cobrança ou recebimento pelo navegador. Não forçar interrupção com sinais repetidos, SIGKILL ou timeout externo durante o drain; ausência de recibo é NO-GO mesmo se o processo tiver terminado. R345–R346 reforçam o tratamento de SIGINT/SIGTERM e seu teste em subprocesso, sujeitos à CI própria. Encerrar túnel; retirar segredos das sessões conforme procedimento do custodiante.
- Em revisão que incorpore R348, depois de o operador confirmar a saída do serviço e o recibo de encerramento, uma terceira sessão local sem `OPENAI_API_KEY` nem `FAISCA_REVIEW_BEARER_TOKEN` pode executar o auditor read-only abaixo, com o mesmo diretório de ledger e o pin independente. Não redirecionar saída para dentro do checkout. `PRIVATE_LOCAL_LEDGER_READONLY_READY` significa somente duas observações locais estáveis e readiness; inclusive um ledger vazio pode estar pronto. Não comprova saída do processo, chamadas reais, fatura ou aprovação pública. Se houver estado incerto ou contadores divergentes, preservar tudo para conciliação; sem retry.

```sh
node scripts/faisca-private-post-run-ledger.mjs "$FAISCA_STAGING_REVIEW_SHA"
```

  Exige `FAISCA_PRIVATE_LEDGER_DIRECTORY` e `FAISCA_PRIVATE_LEDGER_AUDIT_ACK=YES_LOCAL_READONLY_NO_PROVIDER_PROOF` na sessão sem credenciais; utiliza os limites 100/USD 10 do entrypoint. R347/R348 ainda sujeitos à CI própria.
- Custodiante: correlacionar janela de uso com projeto OpenAI autorizado e cobrança observada; não registrar conteúdo das perguntas, token, chave ou dados pessoais. Reserva estimada não equivale a fatura. Se janela não permitir atribuição independente, manter pendente, sem inferir custo.
- Registrar por separado SHA revisada, CI, smoke, navegador, deltas locais, conciliação de uso e encerramento; se faltar evidência, marcar PENDENTE. GO privado é decisão própria. GO público permanece bloqueado; integração operacional Portal/Sites/CRM continua fora deste ensaio.

Nenhum comando deste documento foi executado na VPS por esta entrega.
