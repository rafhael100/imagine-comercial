# Faísca R132 — regressão Chromium da privacidade R131

A R131 acrescentou ao JavaScript privado a recusa de caracteres `Default_Ignorable_Code_Point` em perguntas e respostas. Esta etapa valida o comportamento no **Chromium real**, com a página e o HTTP do laboratório em loopback.

O fluxo `ops/faisca/openai/private-conversation-browser-qa.mjs` agora exercita:
- cinco perguntas fictícias contendo soft hyphen, BOM, bidi isolate, ZWJ ou CGJ, todas recusadas **antes do POST**; contador do provedor sintético deve permanecer zero e campos transitórios devem ser apagados;
- uma resposta HTTP interceptada pelo Playwright, formalmente válida, contendo uma alegação falsa disfarçada por Unicode invisível. O navegador deve apresentar apenas mensagem genérica e nenhuma fonte falsa, sem novas chamadas;
- controles positivos anteriores, autenticação, retenção nula de cookies/storage, ausência de requisições externas e axe WCAG em 320/390/1440 px.

Reprodução no runner com dependências instaladas e browser Chromium:
```bash
node ops/faisca/openai/private-conversation-browser-qa.mjs
node --test tests/faisca-r131-private-browser-ignorable-unicode.test.mjs
npm test
```
O teste é inteiramente fictício e não usa serviços pagos. Os resultados de CI e navegador não provam staging/VPS instalado, nem habilitam atendimento público. Base: R131 #606 na SHA `d7af0803ecdc06c384d3008ce38bb1258d3d024b`, empilhada em R130. R92 está homologada por relato do operador e não foi repetida.

**NO-GO:** não executar deploy, merge, DNS, VPS ou chamada OpenAI; preservar `main`, mascote, site público e `publicFaiscaEnabled=false`. Homologação R95+ em staging, revisão AppSec/LGPD/editorial e autorização operacional explícita seguem pendentes.
