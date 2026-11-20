# Faísca R139 — recibo editorial exato no navegador privado

## Problema remanescente depois da R138
Uma fonte pode constar do catálogo R06 e ainda assim ser usada para legitimar um texto fabricado. O `sourceRecipeBound: true` recebido por HTTP é apenas uma alegação do adaptador. No modo **pergunta livre com resposta editorial**, o navegador não deve aceitar texto diferente das duas receitas editoriais aprovadas pelo host (preço/processo).

## Implementação
- `private-review-page.mjs` gera durante a montagem do script local as duas receitas com texto integral e IDs **ordenados** diretamente de `getGroundedAnswer('pricing'|'process')` no catálogo R06 versionado.
- Resposta `editorial_answer` no navegador privado requer correspondência exata de texto e ID/ordem da receita, independentemente de `sourceRecipeBound` e do HTTP 200. `general_answer` continua com origem Luna+Terra, sem citações, e sujeito aos gates editoriais/privacidade já existentes; cenários fixos continuam sob o gate HTTP autoritativo.
- Teste VM da R138 evoluído para comprovar ID inventado, texto inventado com fonte **válida**, e controle positivo real da receita aprovada.
- `private-conversation-browser-qa.mjs` agora exercita a mesma matriz em Chromium real, com interceptação de HTTP local sintético, sem API paga; mantém axe/WCAG/viewport e ausência de requests externos.

## Execução e limites
`node --test tests/faisca-r138-browser-editorial-source-allowlist.test.mjs`

`node ops/faisca/openai/private-conversation-browser-qa.mjs` (com Playwright/Chromium provisionados)

O browser não decide se a pergunta foi roteada ao tema correto; o HTTP privado permanece autoritativo, requer receita e origem e nunca pode ser substituído pela validação de DOM. Os textos publicados para o navegador são **somente material editorial R06**, não prompts privados, API keys ou dados de clientes.

**Gates:** CI e revisão independente AppSec/LGPD/editorial; homologação da candidata acumulada em staging por operador autorizado. Respeitar R92 reportada, sem presumir instalação R95+. Nenhum merge, deploy, VPS/DNS, dados reais, uso de chave, chamada paga ou integração operacional. `main`, mascote, site público e `publicFaiscaEnabled=false` intactos.
