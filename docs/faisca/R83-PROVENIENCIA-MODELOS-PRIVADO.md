# Faísca R83 — proveniência dos modelos no preview privado

**Base:** R82 PR #555 HEAD `8f46a9a2b325b40d3fd81863ae70c8bee466ddaa`, que depende de R81 #554. Apenas laboratório, branch isolada; nenhuma atualização do mascote, site público ou main.

## Falha reproduzível
O servidor privado R74–R81 aceitava uma resposta com `status=draft_answer` e `modelIds=[]`. A página R79 validava nomes com `Array.every`, que retorna verdadeiro para vetor vazio. Um provider injetado ou configurado incorretamente podia fazer a interface exibir “Resposta gerada” sem prova sequer nominal de execução Luna + Terra.

## Correção e provas
- A resposta privada com status `draft_answer` exige exatamente os dois IDs conhecidos, na ordem classificador Luna → redator Terra; valores vazios, duplicados, trocados ou não revisados resultam em HTTP 503 sem texto do modelo.
- A interface repete a validação (não apenas `every`) antes de apresentar o texto, como defesa adicional.
- Fixtures históricas R73/R75–R78 agora indicam os dois modelos de laboratório, preservando seus objetivos originais.
- `tests/faisca-r83-model-provenance-private-review.test.mjs` exercita o endpoint HTTP loopback real e verifica que 7 respostas inválidas não são expostas nem repetidas.
- `ops/faisca/openai/private-review-browser-qa.mjs` exerce Chromium interceptando uma resposta HTTP sintética com modelos vazios e exige UI neutra, token limpo e nenhuma chamada paga.

## Gates
Executar `node --test tests/faisca-r83-model-provenance-private-review.test.mjs`, `node --test tests/faisca-*.test.mjs` e `node ops/faisca/openai/private-review-browser-qa.mjs` com Chromium/Playwright já provisionados em CI. Além disso, workflows PHP/Portal/PG/SEO na HEAD exata da PR.

**Limitações:** lista de IDs no envelope é metadado, NÃO atestação criptográfica da OpenAI nem verificação de grounding semântico. Ainda precisa de revisão independente AppSec/editorial/LGPD, confronto de Usage real e staging privado. Proibidos deploy, merge, DNS/VPS, dados reais, CRM/Portal operacional, leads, tickets, cobranças ou habilitação pública (`publicFaiscaEnabled=false`).