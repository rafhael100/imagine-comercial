# Faísca R16 — dúvidas de pós-venda não preenchem campos comerciais

**Base:** R15 (#478) / cadeia R11–R15 em PRs draft. **Laboratório sintético.**

## Defeito

O roteador de campos `R09` verifica e recusa dados pessoais e injeções, mas ainda aceitava uma frase cujo tema principal fosse **um serviço já contratado**. Se nela também aparecesse uma opção comercial permitida, o roteador podia classificar a frase como resposta a uma pergunta da qualificação R08. Exemplo sintético: "Quero cancelar meu contrato e captar leads depois." Isso podia ser indevidamente interpretado como `capture_leads` quando a pergunta aberta era sobre objetivo.

Esse tipo de sobreposição representa um risco de contaminação do perfil comercial. Não significa que uma contratação, cancelamento ou pagamento real tenha ocorrido.

## Regra adicionada

`prepareFieldRouteRequest` recusa localmente a extração de campos se o preflight de `core.respond` identificar `after_sales`, `support_status`, `support_issue`, `support_billing`, `support_cancel`, `privacy` ou `human`, além das recusas já existentes por PII, instruções impróprias e formato inválido.

O roteiro volta a orientar a necessidade de suporte ou esclarecer a próxima pergunta em vez de gravar silenciosamente um campo comercial; nenhuma chamada a IA, CRM ou Portal é realizada.

## Regressões

`tests/faisca-r16-private-field-boundary.test.mjs` valida sete frases mistas (pós-venda + intenção comercial), preservação do perfil R08 durante triagem e manutenção de perguntas legítimas sobre objetivo, materiais, previsão e consentimento.

```bash
node --test tests/faisca-r16-private-field-boundary.test.mjs tests/faisca-r09-field-router.test.mjs tests/faisca-r08-journey.test.mjs
npm test
```

**Gates:** CI na SHA desta PR, revisão independente e ensaios de diálogos multietapas. As expressões são heurísticas fechadas e não provam uma compreensão semântica universal. Sem clientes reais, merges, deploy, gastos, credenciais, acesso ao Portal/CRM ou alteração da identidade visual.
