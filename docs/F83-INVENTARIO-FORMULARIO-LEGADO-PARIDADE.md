# F83 — Inventário do formulário de orçamento legado e lacunas de paridade

**Data da observação pública:** 10/11/2026. Fonte: https://www.imaginecomunicacao.com.br/fale-conosco.html

## O que foi observado — e o que não foi
O conteúdo público mostra os campos **Nome, Cargo, Email, Telefone, Celular, Mensagem** e uma **pergunta aritmética de verificação**, além do botão de solicitação de orçamento. A mesma família de formulário aparece também em outras páginas institucionais, incluindo a página sobre a Imagine. **Nenhum formulário foi submetido**, nenhuma requisição foi interceptada e não foi comprovado o recebimento, funcionamento interno, obrigatoriedade exata dos campos, destino dos dados ou proteção antirrobô efetiva. A pergunta aritmética muda entre visualizações; não preservar a conta literalmente como um contrato de API.

## Comparação com a prévia privada F82

| Campo observado no legado | Controle F82 | Estado |
|---|---|---|
| Nome | `lead-name` | Visível na prévia, operação não validada |
| Cargo | — | Ausente; Produto deve decidir necessidade/campo |
| Email | `lead-email` | Visível na prévia, regras finais pendentes |
| Telefone | `lead-phone` | Visível, mas legado também separa Celular |
| Celular | — | Ausente; revisar se deve permanecer separado |
| Mensagem | `lead-details` | Visível na prévia, operação não validada |
| Desafio aritmético | — | Substituir por proteção antirrobô server-side homologada, não copiar a conta |

**Inventário: 4/7 controles com correspondência apenas visual, 3/7 lacunas abertas.** Essa razão não é um percentual de conclusão técnica, conversão ou prontidão de lançamento. O novo seletor de serviço da F82 é um aprimoramento adicional, não prova de paridade.

## Implementação
- `src/lib/legacy-budget-parity.mjs` contém campos públicos observados, data, fonte e status de evidência, além de avaliar a presença dos IDs correspondentes na **prévia privada**.
- `tests/legacy-budget-parity.test.mjs` verifica o inventário, lacunas, casos negativos e preservação das flags de bloqueio.
- `scripts/report-launch-blockers.mjs` inclui a avaliação F83 no relatório **offline**, sem novas permissões, redes, tokens, dados reais, deploy ou mudanças de DNS.
- Mesmo que todos os campos visíveis venham a ser incluídos, `legacyContactIntakeParityApproved` e `deploymentAuthorized` permanecem `false`.

## Para fechar o gate F70 de verdade
1. Decidir quais campos do formulário legado precisam ser preservados, quais são opcionais e como lidar com Telefone/Celular e Cargo, com revisão de minimização e privacidade.
2. Definir regras finais de contato no Portal/CRM: F30 exige e-mail no laboratório Comercial; CRM F3-06 admite telefone **ou** e-mail para o formulário de Sites.
3. Substituir o desafio aritmético por proteção antiabuso adequada (rate limits, detecção de automação, controle de origem), com tratamento acessível e seguro; evitar promessas de impossibilidade de spam.
4. Demonstrar em staging privado, com usuários fictícios e provas independentes, aceite, falha, retries, conservação do vínculo por tenant, autorização, entrega e confirmação verificáveis.
5. Confrontar experiência de orçamento legada e nova: responsividade, acessibilidade, mensagem de confirmação ou erro e acompanhamento comercial. Obter revisão jurídica e aprovação explícita separada do release.

O formulário público permanece desligado. A inspeção do site legado foi **somente leitura**. Sem clientes reais, novas despesas, `main`, DNS ou deploy.
