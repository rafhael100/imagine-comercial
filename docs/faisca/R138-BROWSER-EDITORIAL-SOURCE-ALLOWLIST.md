# Faísca R138 — catálogo editorial autoritativo também no navegador privado

## Risco observado
O HTTP privado já rejeitava `sourceIds` fora do catálogo R06 (R85), mas o segundo gate do navegador em R137 validava somente o **formato** do ID. Um adaptador local defeituoso retornando HTTP 200 com `sourceRecipeBound: true` poderia fazer o DOM exibir uma citação inventada e aparentemente auditada.

## Correção
`ops/faisca/openai/private-review-page.mjs` gera a allowlist de IDs a partir de `getGroundingSources()` do catálogo R06 **local e versionado**. O script servido ao browser (sem acesso a chaves) rejeita qualquer fonte não pertencente à lista; o protocolo ainda exige esquema, fonte, origem, proveniência Luna+Terra, campo `requiresEditorialReview` e `publicReady: false`. A lista é serializada no JS privado; nenhum dado de operador, prompt ou credencial é incorporado.

## Prova sintética executável
`node --test tests/faisca-r138-browser-editorial-source-allowlist.test.mjs`

Em ambos os caminhos do navegador privado (cenário fixo e resposta editorial à pergunta fictícia): um envelope HTTP 200 com ID sintaticamente válido, mas inventado, é recusado; DOM e fontes são limpos, token e textarea zerados, UI recuperada, sem retry. Um ID presente no catálogo continua passando nesse isolamento. O teste usa VM e Response sintetizada, **sem chamada paga**.

## Limitações e gates
A validação de lista no navegador não verifica se a passagem foi corretamente usada no texto, nem assegura sua adequação à pergunta. Essa vinculação permanece tarefa do gate HTTP e de revisão editorial humana. CI, Chromium/axe, AppSec/LGPD independente e homologação privada acumulada continuam necessários. A R92 foi homologada por relato do operador; esta entrega não implica R95+ instalada na VPS.

**NO-GO:** sem merge, deploy, produção, Portal/CRM, VPS/DNS, dados reais, gastos, leads ou tickets. `main`, site público, mascote aprovado e `publicFaiscaEnabled=false` preservados.
