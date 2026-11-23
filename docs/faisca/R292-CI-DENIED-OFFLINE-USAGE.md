# R292 — bloqueio da conciliação privada R288/R289 em CI

**Base:** R291 #771 HEAD `3de5a92f386f303729d8b085bb51309844dd1372`, cadeia draft preservada e `main` intocada.

## Controle implementado

O comando `scripts/faisca-private-usage-review.mjs` anteriormente aceitava `FAISCA_PRIVATE_OPERATOR_USAGE_REVIEW=REVIEW_ONLY` mesmo quando `GITHUB_ACTIONS=true` ou `CI=true` estivesse definido. Esse comando recebe agregados de consumo introduzidos manualmente e caminho do ledger local; sua execução em CI contraria a fronteira de dados privados. Agora recusa ambos os ambientes **antes** de interpretar argumentos, ler stdin ou consultar o ledger, mesmo que a variável REVIEW_ONLY esteja presente. Os erros continuam genéricos e não ecoam valores, caminhos, prompts ou credenciais.

Com o teste `node --test tests/faisca-r292-offline-usage-ci-denied.test.mjs`, três cenários CI são recusados e uma execução de laboratório com números fictícios ainda funciona. Os testes comparam bytes de todos os arquivos duráveis antes e depois, sem editar marcadores ou liberar requisições.

## Gates

Os seis workflows devem comprovar Node/HTTP, Chromium/axe/WCAG, SEO/build, Onepage/Portal, PostgreSQL descartável e PHP. Esses testes não autenticam dados oficiais da OpenAI, nem instalam R95–R292 na VPS. Não houve acesso a credenciais, execução paga, deploy, merge, efeitos Portal/Sites/CRM, alteração DNS ou habilitação pública. Permanecem as revisões AppSec/LGPD/FinOps/editorial e a comprovação independente Docker/PID/HTTP do staging. **NO-GO público**.
