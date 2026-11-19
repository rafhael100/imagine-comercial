# Faísca R85 — somente fontes editoriais existentes na revisão privada

Base: R84 #557, SHA `10c12aa9304b788087fdb201ac5e91a2856e5122`. PR DRAFT / REVIEW ONLY.

## Falha identificada

O servidor privado de revisão da IA R74–R84 validava a forma e o tamanho de `sourceIds`, mas aceitava qualquer identificador bem formado como se fosse uma fonte editorial da Imagine. Uma implementação injetada do provedor podia devolver `faisca.passage.fake@r06-1`, resultando em citação visual indevida.

## Correção

- `ops/faisca/openai/private-review-http.mjs`: importa os identificadores exatos de `getGroundingSources()` (catálogo R06 já pinado), aplica allowlist e recusa IDs desconhecidos e repetidos antes de serializar a resposta HTTP. Respostas recusadas recebem apenas 503 neutro, sem eco dos dados arbitrários nem retry.
- Fixtures dos testes R72–R78 que usavam o marcador inexistente `fixture` foram atualizadas para um ID editorial realmente existente, sem alterar os fluxos nem tocar no conteúdo editorial.
- `tests/faisca-r85-private-editorial-sources.test.mjs`: quatro regressões para fonte válida, ID desconhecido/malformado/duplicado, getter hostil e fallback `unsupported` sem fontes.

## Validação

```sh
node --test tests/faisca-r85-private-editorial-sources.test.mjs
node --test tests/faisca-*.test.mjs
```

CI Node/Chromium, PHP, Portal Onepage, PostgreSQL descartável e Comercial/SEO devem passar na SHA final. Revisão independente AppSec/editorial obrigatória. Esta allowlist atesta somente a existência do **identificador**, não que a frase gerada por Terra seja semanticamente fiel a ele. Continua sendo um rascunho para revisão humana. Uma validação futura deve amarrar cada fonte ao recipe/answerId selecionado e testar correspondência factual.

Sem merge em main, deploy, VPS, DNS, dados de clientes, chaves, chamadas de API faturadas, CRM/Portal operacional, pedido, cobrança ou mudança no mascote. `publicFaiscaEnabled=false`.
