# R342 — entrega acumulada para homologação privada (24/11/2026)

**REVIEW ONLY / NO-GO público.** A R92 já foi relatada como homologada pelo operador. Não repetir essa versão nem presumir a instalação da R95 ou de qualquer descendente. O objetivo agora é uma única homologação da cadeia acumulada com evidências separadas para HTTP, navegador, ledger local e cobrança do provedor.

## Seleção de revisão
- R95 #570: `91951653fca999f26595cc8113fbaff151225a89` — [6/6 CI](https://github.com/rafhael100/imagine-comercial/actions/runs/44656914085).
- R340 #821: `84f139c13cef53210d639669ee7338eb0f9fc349` — [CI de jornada privada, Chromium, axe e build](https://github.com/rafhael100/imagine-comercial/actions/runs/45460500059) e outros cinco workflows aprovados. Fixtures apenas.
- R341 #822: `0aee338799671bd774575d5e35f09759f5a10a79` — acrescenta readiness do observador antes do negativo e antes do positivo; não adotar sem seis workflows aprovados e revisão independente.

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

Outra sessão local privada, mesmo checkout limpo/pin, sem chave do provedor. O custodiante fornece apenas o bearer privado e o caminho EXATO do ledger existente. A variável do observador é `FAISCA_PRIVATE_LEDGER_DIRECTORY` (não `FAISCA_PRIVATE_LEDGER_DIR`). Na R340/R341 o entrypoint fixa 100 requisições e USD 10 de reserva estimada local; o observador deve usar os mesmos valores, não limites inventados ou um novo diretório.

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
- Encerrar o serviço normalmente e aguardar o drain/ACK antes de inspeção final. Encerrar túnel; retirar segredos das sessões conforme procedimento do custodiante.
- Custodiante: correlacionar janela de uso com projeto OpenAI autorizado e cobrança observada; não registrar conteúdo das perguntas, token, chave ou dados pessoais. Reserva estimada não equivale a fatura. Se janela não permitir atribuição independente, manter pendente, sem inferir custo.
- Registrar por separado SHA revisada, CI, smoke, navegador, deltas locais, conciliação de uso e encerramento; se faltar evidência, marcar PENDENTE. GO privado é decisão própria. GO público permanece bloqueado; integração operacional Portal/Sites/CRM continua fora deste ensaio.

Nenhum comando deste documento foi executado na VPS por esta entrega.
