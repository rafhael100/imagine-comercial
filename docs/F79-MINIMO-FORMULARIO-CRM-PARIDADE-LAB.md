# F79 — Mínimo estrutural Comercial × CRM Imagine F3-06 (laboratório)

## Referência realmente consultada
`rafhael100/imagine-crm` na branch `dev/f3-12-idempotency-cas-lab-2026-11-08`:
- `app/Core/Leads/LeadDraftFields.php`
- `app/Core/Leads/ImagineSiteFormMinimumInspector.php`
- `app/Core/Leads/ImagineSiteFormMinimumAssessment.php`

O CRM classifica um **rascunho sintético para formulário de Sites Imagine** como estruturalmente completo quando há nome e ao menos um contato plausível (e-mail **ou** telefone), desde que nenhum contato fornecido seja inválido. Não é uma regra universal de leads, nem autorização de captura.

## Implementação e diferenças relevantes
O módulo `src/lib/crm-form-minimum-parity-lab.mjs` reproduz esses *resultados estruturais* por um motor Node isolado. Campos de entrada exatos: `name`, `email`, `phone`, cada um texto não vazio ou `null`. Validação de rascunho impede controles de linha e textos longos. Telefone usa a mesma heurística provisória documentada no CRM: 8–15 dígitos, permitindo separadores comuns, sem afirmar que o número existe.

A verificação de e-mail em Node é aproximada; **não é byte-equivalente ao `filter_var` de PHP**. Esta entrega não autoriza trocar a validação do backend pela validação do navegador. Um eventual contrato homologado deve executar testes de paridade com as duas implementações e aprovar regras de normalização.

A F30 do Comercial, propositalmente, exige e-mail no seu rascunho de teste; o CRM F3-06 admite telefone sem e-mail. A F79 **não altera a F30**, não acrescenta formulário e não muda o gate F70 de preservação de orçamento do site legado. A equipe de Produto/Privacidade deverá decidir quais campos são obrigatórios na versão pública e sob qual base legal/finalidade.

## Garantias do laboratório e limites
A resposta contém somente indicadores de estrutura e três flags `false` para entrega, armazenamento e recibo. Não devolve nome, contato ou campos livres; não há fetch, endpoint, API, transação, CRM, Portal ou serviço externo. Testes negativos cobrem contato extra inválido, ausência de nome, controles, excesso de campos e a incompatibilidade consciente com F30.

Nenhum teste estrutural comprova consentimento, isolamento multiempresa, autorização de vínculo, antispam, entrega durável, política de retenção ou segurança operacional. Permanecem necessários staging privado, integração autenticada, LGPD, revisão independente e evidências operacionais antes da liberação de captação real.

PR draft somente; `main`/DNS/produção inalterados, sem despesas.
