# Faísca R150 — aliases numéricos de IPv4 no laboratório privado

## Lacuna
A aplicação não consulta DNS, mas parsers de URL podem aceitar representações alternativas de um IP. O parser WHATWG de Node converte `127.1`, `127.0.1`, `0x7f000001`, `0x7f.1` e `0177.0.0.1` para `127.0.0.1`. Os filtros R148/R149 bloqueiam endereços IPv4 usuais, domínios sem protocolo, IDN e pontos Unicode, mas não necessariamente esses aliases. Uma entrada de teste aparentemente fictícia poderia transmitir um identificador operacional.

## Alteração
- `ops/faisca/openai/private-identifier-risk.mjs`: bloqueio lexical conservador para IPv4 privado abreviado, octal e hexadecimal antes de pedido pago e no egress autoritativo.
- `ops/faisca/openai/private-review-page.mjs`: proteção independente de browser para a pergunta antes do POST e resposta após HTTP 200, sempre com `textContent` e limpeza de texto/bearer.
- `tests/faisca-r150-private-ip-alias.test.mjs`: prova do parsing real via `new URL`, fixtures sintéticas, modelos Luna/Terra mock com contadores sem retry, HTTP autenticado em loopback sem chamada ao provedor e execução do JavaScript real do navegador via VM.
- A CI existente verifica Node, HTTP, Chromium/axe/WCAG, CSP, integridade dos assets, compatibilidade Onepage/Portal, PHP, PostgreSQL descartável e Comercial/SEO/build.

## Limites
Pode haver outros aliases/codificações: este é um *tripwire* de privacidade, não DLP abrangente. Algumas versões numéricas inocentes podem ser barradas por precaução. Não houve resolução DNS, credenciais, chamadas pagas ou dados reais. O teste pago Luna/Terra e a homologação R92 informados pelo usuário não foram repetidos; R95+ não foi presumida instalada na VPS.

**NO-GO público:** alterações apenas em branch isolada/PR draft. `main`, site público, mascote aprovado e `publicFaiscaEnabled=false` permanecem protegidos. Revisão independente AppSec/LGPD/editorial e homologação cumulativa em staging privado ainda são gates; não executar deploy, DNS, VPS, CRM/Portal ativo, geração de leads/tickets ou cobrança.
