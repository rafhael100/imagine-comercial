# R113 — prazo absoluto no smoke privado de staging

**DRAFT / laboratório.** Base R112 #587 `b4cd2fa262516055ee64c0ed2523705d162f7447`.

## Falha técnica

`inspectFaiscaPrivateReviewUi()` abortava uma tentativa GET após 3 segundos, mas aguardava diretamente `fetchImpl()` e `reader.read()`. Um transporte sintético ou adaptador de teste que ignorasse `AbortSignal` podia deixar o processo aguardando indefinidamente; o `finally` também aguardava `reader.cancel()`, que pode nunca resolver. Isso impediria a prova rápida de smoke privado e confundiria um teste travado com pronto.

## Correção, testes e limite

- `awaitSmokeOrAbort` combina abort com `Promise.race` em fetch e leitura sem confiar que o transporte é cooperativo.
- Cancelamento de stream é solicitado sem bloquear o retorno da verificação; timers e listener são liberados.
- Deadline padrão **3.000 ms** preservado; parâmetro opcional restrito a 50–3.000 ms permite fixtures rápidas em CI, sem afetar a configuração de produção.
- `tests/faisca-r113-private-staging-smoke-deadline.test.mjs` usa `fetch`, `read` e `cancel` não cooperativos, prova BLOCKED sem modelo pago e mantém controle positivo dos três arquivos HTML/JS/CSS reais no loopback.

Não prova a integridade ou disponibilidade da VPS e não autoriza porta pública. R92 foi relatada homologada, mas versões R95–R113 ainda exigem homologação isolada por operador autorizado, SHA revisada e verificação de ledger persistente. Os testes permanecem sintéticos. `publicFaiscaEnabled=false`; sem merge, site público, deploy, DNS, VPS, chaves, IA paga, dados reais, Portal/CRM operacional, leads, tickets ou cobrança.
