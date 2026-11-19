# R60 — matriz executável de invariantes da qualificação Onepage

**DRAFT / REVIEW ONLY.** Base R59 [#531](https://github.com/rafhael100/imagine-comercial/pull/531), sobre SEC-01 [#530](https://github.com/rafhael100/imagine-comercial/pull/530) → R58 [#528](https://github.com/rafhael100/imagine-comercial/pull/528) e predecessoras. Nenhuma alteração na aplicação pública, no mascote aprovado ou em configurações operacionais. `publicFaiscaEnabled=false`.

## O que foi acrescentado

O teste `tests/faisca-r60-qualification-state-invariants.test.mjs` explora combinações de duas ações (inclusive ações não anunciadas ao visitante) a partir de sete estados importantes: Onepage consentido/recusado, Landing Page, trocas pendentes em ambas as direções, qualificação parcial e sessão limpa. Para cada transição, exige:

- Estado imutável, ações sem IDs duplicados e no máximo seis ações nos envelopes de resposta R08/R58.
- `r08_next_steps` somente com qualificação completa, fase `complete` e nenhuma troca pendente.
- `r58_portal_preparation_only` somente para Onepage concluído, sem `pendingGoal`, com texto informando aceite explícito, nenhuma cotação/pedido/cobrança produzida e sem URL de checkout ou preço.
- Nenhuma preparação Onepage após confirmação de troca para Landing Page ou reinício.
- Teste deterministicamente limitado para não criar dependência de rede, credenciais, LLM, fornecedores ou dados reais.

### Execução

```sh
node --test tests/faisca-r59-pending-service-guard.test.mjs tests/faisca-r60-qualification-state-invariants.test.mjs
node --test tests/faisca-*.test.mjs
```

O teste não substitui Chromium/axe, HTTP real no loopback, revisão de contratos do Portal ou staging privado homologado; estes devem ser conferidos separadamente nos workflows da **HEAD exata**. A revisão independente deve verificar que o conjunto de ações e estados representa ameaças reais e que nenhuma navegação pode converter o resumo de interesse em pedido sem sessão Portal, MFA, grants, preço de servidor, termos/aceite e recibos de operação.

**Sem merge, deploy, alteração de DNS/VPS, chamada a LLM externo, operação CRM/Portal, envio de leads/tickets ou cobrança.** CI verde é apenas evidência de laboratório.
