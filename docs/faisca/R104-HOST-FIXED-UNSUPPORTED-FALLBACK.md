# Faísca R104 — texto `unsupported` pertence ao host

**Base:** R103 #578, candidata privada de laboratório; sem publicação. Não substitui a revisão independente.

## Defeito

Mesmo após os bloqueios de identificadores R101, o host HTTP podia aceitar um `unsupported` sem fontes/modelos com texto arbitrário enviado por um adaptador injetado. Esse texto podia afirmar benefícios, compromissos ou ações não verificadas sem um `answerId` editorial. O fato de não conter CPF ou telefone não o tornava correto.

## Correção

- A cadeia Luna/Terra continua devolvendo o mesmo fallback fixo conhecido, agora exportado como `FAISCA_OPENAI_UNSUPPORTED_FALLBACK`.
- O filtro HTTP independente exige correspondência **exata** com o fallback do host quando o status é `unsupported`, inclusive para fixtures sem schema. Nenhuma resposta livre do modelo pode usar esse status para contornar a checagem editorial.
- `draft_answer` e conversas fictícias têm suas políticas anteriores preservadas, e `unsupported` segue sem modelos, fontes ou ações.
- Regressão Node/HTTP: `node --test tests/faisca-r104-host-fixed-unsupported-text.test.mjs tests/faisca-r101-private-unsupported-output-boundary.test.mjs`.

## Gates

CI em seis workflows na HEAD exata, revisão AppSec/editorial independente, homologação privada do código composto por operador com SHA confiável e ledger persistente já existente. A homologação R92 anterior **não** prova que R95–R104 rodaram na VPS. Filtros e um fallback conservador não provam segurança semântica de todas as respostas. Contratação pública requer Portal real com autenticação, autoridade empresarial, contrato, aceite e recibo, seguida de GO humano específico.

Sem merge em `main`, deploy, DNS/VPS, credenciais, LLM real, dados reais, CRM/Portal operacional, leads, tickets ou cobranças. Mascote, site público e `publicFaiscaEnabled=false` inalterados.
