# Faísca R92 — composição dos dois laboratórios privados (DRAFT)

Base imutável: R90 #564 (`cb099b31ad70079e6a173220a255544c37e30244`), que contém R87 #560 e R88 #562. Esta candidata incorpora *por conteúdo/objetos Git, sem merge* os 12 arquivos revisados da trilha R86 staging #561 → R89 #563 → R91 #565 (HEAD `1a7f1ea009a0de32d81fa73a44ef50da8630e1a5`).

## Por que compor
A interface privada e a preparação de staging evoluíram em branches paralelas, isoladas corretamente. A homologação exige que a **mesma HEAD candidata** tenha os controles do modelo/fonte e o preflight, o ledger durável e a entrada segura do servidor. Este commit de composição preserva o `private-review-http.mjs` atualizado pela R87, o `private-review-page.mjs` atualizado pela R90 e sobrepõe somente os arquivos de staging/ledger/entrypoint nas versões R91.

## Prova executável
`node --test tests/faisca-r92-private-staging-composition.test.mjs` verifica, com ambiente sintético e sem chave real, um preflight read-only com SHA pinada, um smoke GET dos três assets via servidor HTTP loopback e um POST de fixture com `sourceRecipeBound=true`, proveniência e `publicReady=false`. A separação das chamadas é medida: 0 no GET, 1 na fixture POST, 0 chamadas reais OpenAI. CI Node/Chromium/SEO/Portal/Postgres deve ser reexecutada na HEAD exata desta candidata.

## Gates antes de uso humano em staging
- Revisão independente AppSec do delta inteiro R72–R92, incluindo riscos de composição não equivalentes a merges.
- Confirmar os 6 workflows GitHub Actions desta HEAD, depois conferir pin independente e execução do preflight na VPS **somente por operador autorizado**. O build do site público e mascote continuam desligados.
- A experiência não é o chatbot público: ela só aceita perguntas sintéticas, exige token temporário e retorna rascunhos editoriais. A identidade Portal/empresa, cotação/contrato/aceite/recibo, LGPD e mecanismos de produção são gates distintos.
- Proibido usar checkout público, realizar merge/deploy/DNS/VPS, ler credenciais ou disparar leads, tickets ou cobranças sem autorização humana específica.

`publicFaiscaEnabled=false`; nenhuma publicação. Esta documentação é evidência de laboratório, **não** GO de produção.
