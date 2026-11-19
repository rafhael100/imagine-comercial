# Faísca R59 — guarda de troca pendente antes da preparação Onepage

**DRAFT / REVIEW ONLY.** Base SEC-01 [#530](https://github.com/rafhael100/imagine-comercial/pull/530), sobre R58 [#528](https://github.com/rafhael100/imagine-comercial/pull/528) → R57 [#526](https://github.com/rafhael100/imagine-comercial/pull/526) → R56 [#525](https://github.com/rafhael100/imagine-comercial/pull/525) → R55 [#523](https://github.com/rafhael100/imagine-comercial/pull/523) → R54 [#522](https://github.com/rafhael100/imagine-comercial/pull/522) → R53 [#521](https://github.com/rafhael100/imagine-comercial/pull/521) → R52 [#520](https://github.com/rafhael100/imagine-comercial/pull/520) → R51 [#504](https://github.com/rafhael100/imagine-comercial/pull/504).

## Problema reproduzível, antes da correção

1. Concluir a qualificação Onepage e responder à autorização de contato.
2. Enviar `r08:change_service` → `goal_campaign`, sem `confirm_goal` nem `cancel_goal`.
3. Enviar novamente `r08:change_service` enquanto a fase é `service_change_pending`, embora o menu de confirmação não ofereça essa ação.
4. Na implementação anterior, `r08:keep_service` restaurava fase `complete` com `session.journey.pendingGoal='goal_campaign'`; `r08:prepare_onepage` exibia a preparação Onepage apesar da troca pendente.

A preparação **não criava pedido nem efetuava pagamento**, mas a inconsistência quebra a condição de consentimento de escolha explícita antes da transição para o Portal.

## Correção e evidências

- O comando `r08:change_service` durante `service_change_pending` é tratado como outra ação não aplicável: permanece na fase de confirmação e exibe **Confirmar a troca / Manter a solução atual**.
- `nativeOnepagePreparationReply` exige `pendingGoal === null` como defesa em profundidade, além da fase `complete`, do serviço Onepage e dos gates de efeitos operacionais inativos.
- `nextStepReply` não anuncia próximos passos com `pendingGoal` ativo.
- Os testes Node `tests/faisca-r59-pending-service-guard.test.mjs` verificam o caminho antigo, três estados da autorização de contato, manutenção e confirmação válidas, mensagens sensíveis mascaradas e a closure HTTP local R08.

### Comandos de laboratório

```sh
node --test tests/faisca-r59-pending-service-guard.test.mjs tests/faisca-r58-onepage-portal-preparation.test.mjs tests/faisca-sec01-qualification-action-envelope.test.mjs
node --test tests/faisca-*.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/qualification/http-browser-qa.mjs
```

## Revisão independente e gates reais

A pessoa revisora deve confirmar o ataque pré-correção e o bloqueio na HEAD da R59; revisar o ramo `service_change_pending`, outros caminhos de volta para `complete`, suporte anônimo e privacidade; confrontar CI Node/Chromium/HTTP/compatibilidade Portal na SHA exata, sem extrapolar da CI de outra PR. Confirmar `publicFaiscaEnabled=false` e a ausência de alterações ao mascote e ao site público.

Ainda faltam autenticação, MFA, grants por empresa, catálogo e precificação de servidor, contrato publicado e aceite explícito, idempotência e recibos no Portal, fluxo de entrega no Sites, faturamento, observabilidade, privacidade, revisão independente e staging privado operacional autorizado. **Não executar merge, deploy, DNS, VPS, CRM/Portal operacional, fornecedores externos, geração de leads, tickets, cobranças ou testes com dados reais.** CI verde não habilita compra e não é homologação de produção.
