# Faísca R90 — resiliência de resposta na interface privada

**Base:** R88 #562 (`59358c6a4399bd2a0f8c21db97cbda99812b7b91`). Esta PR permanece DRAFT, exclusiva do laboratório: **não** altera o mascote, a publicação do site, `main` ou `publicFaiscaEnabled=false`.

## Falha reproduzível
A página privada consumia `response.json()` sem limite explícito de bytes nem deadline. Um endpoint alterado ou resposta acidentalmente excessiva poderia manter o botão em espera ou causar processamento excessivo na máquina do operador. Ela também aceitava listas de fontes grandes/duplicadas se outros indicadores do envelope fossem preenchidos.

## Correção testável
- Resposta JSON lida como stream com teto de **16 KiB**, UTF-8 estrito e checagem de Content-Length; stream cancelada após erro.
- AbortController e deadline de **35 s** envolvendo chamada e leitura. O limite prevê duas chamadas sequenciais até 12 s no laboratório, não é SLA.
- O navegador recusa fonte vazia, mais de 12 fontes, duplicação, IDs malformados, resposta curta ou com controles, sem exibir a resposta.
- Novo teste Node executa o código JavaScript efetivo num DOM sintético, com resposta saudável e quatro envelopes adversariais. QA Chromium/HTTP acrescenta interceptações malformadas, sem nenhuma chamada paga.
- Qualquer falha limpa a apresentação, mantém o token transitório apagado, reabilita o botão e não mostra erro interno/segredo.

## Gates
1. GitHub Actions completos na SHA exata desta R90, com `node --test tests/faisca-r90-private-browser-response-bounds.test.mjs` e `node ops/faisca/openai/private-review-browser-qa.mjs`.
2. Revisão independente AppSec, editorial, acessibilidade e UX, especialmente cancelamento de streams e timeout com duas respostas IA.
3. Reconciliar separadamente a trilha de staging R86 #561 → R89 #563 e a trilha de qualidade R87 #560 → R88 #562 → R90. Nenhuma integração operacional ou publicação antes do gate.

**Sem VPS/DNS, merge, deploy, credenciais, cliente real, chamadas OpenAI, Portal/CRM operacional, leads, tickets, contratos ou cobrança.** Testes sintéticos não demonstram qualidade factual, identidade do Portal ou prontidão pública.
