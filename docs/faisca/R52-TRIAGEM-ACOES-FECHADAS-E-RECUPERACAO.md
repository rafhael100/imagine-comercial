# Faísca R52 — correção segura de escolhas e erros na triagem anônima

**Tipo:** correção de laboratório, PR filha da candidata integrada R51 [#504](https://github.com/rafhael100/imagine-comercial/pull/504). **Não publica o Faísca.**

## Defeito reproduzível na R10 (ainda presente na linha consolidada R51)

- `reviseSupportOption(createSupportSession(), 'service')` devolvia uma **nova sessão válida** mesmo sem haver serviço respondido. O controlador podia responder "Vamos corrigir o serviço" a um ID de ação antigo, forjado ou não exibido.
- `respondSupportJourney(createSupportJourney(), {type:'action', id:'r10:topic:billing' + 'x'.repeat(100000)})` aceitava o ID como dado do envelope sem limite, antes de recusá-lo apenas no despacho. Controles ASCII/limites eram implícitos ao navegador, não garantidos no contrato do módulo.

Isso não demonstra vazamento de PII ou efeito operacional; corrige uma fronteira de validação e um feedback enganoso em entradas não apresentadas pela UI.

## Correção mínima

1. `ops/faisca/support/triage.mjs`: correção só aceita campo já selecionado. Se ausente, recusa sem mutação.
2. `ops/faisca/support/journey.mjs`: ações exigem ID ASCII fechado, não vazio, até 96 caracteres, sem espaços, caracteres invisíveis ou de controle; texto livre continua descartado sem leitura do conteúdo.
3. `tests/faisca-r52-support-actions.test.mjs`: cinco casos para campos ausentes, correção não oferecida, IDs gigantes/invisíveis, fluxo aprovado (qualificação anônima, revisão e reset) e privacidade de texto livre.

## Reproduzir e exigir evidência da HEAD

```sh
node --test tests/faisca-r10-support.test.mjs tests/faisca-r10-journey.test.mjs tests/faisca-r52-support-actions.test.mjs
node --test tests/faisca-*.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/support/browser-qa.mjs
```

O workflow `faisca-guided-lab.yml` já coleta `tests/faisca-*.test.mjs` e QA do navegador. A suíte Comercial/SEO/Portal e demais workflows da PR dependente devem ser avaliados **na SHA desta entrega**, não pela CI 26/26 da R51 anterior.

## Revisão independente — somente leitura (Codex/Juliana)

- Confirmar que nenhum ID bloqueado altera assunto/serviço/detalhe, que correção válida limpa seus dependentes e que um reset volta à sessão anônima limpa.
- Validar entradas hostis (string gigante, controles, Unicode invisível, objeto clonado/proxy) sem executar getters e sem eco de dados digitados.
- Conferir `git diff` contra R51: exclusivamente estes dois módulos, o teste e este documento; manter `src/`, `public/`, mascote PNG e `publicFaiscaEnabled=false`.
- Conferir os 5 workflows Faísca/Comercial/SEO e, quando aplicável à candidata, os demais checks associados à **HEAD exata**; apontar falha por job com reprodução. Não concluir revisão de produto apenas pela CI verde.
- Reportar achados BLOCKER/HIGH/MEDIUM/LOW, decisão `CHANGES REQUIRED` ou `READY FOR HUMAN REVIEW`, preservando PR draft.

**Limites mantidos:** sem merge, DNS, deploy, VPS, credenciais, serviços pagos, modelo externo, envio de lead/ticket, CRM/Portal real, cobrança, uso de dados pessoais reais ou modificação no site comercial. Estado somente em memória, sem operador conectado; resumo copiável, não enviado.
