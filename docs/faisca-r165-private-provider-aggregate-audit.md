# Faísca R165 — auditoria offline de agregados do provedor (REVIEW ONLY)

## Objetivo
A R160 lê o saldo local de reservas duráveis e a R161–R164 acompanha o caminho negativo e o positivo na conversa privada. Esses dados NÃO demonstram o total de chamadas ou o faturamento no provedor. A R165 cria um comparador **somente de dados numéricos e sintéticos** para detectar divergências entre uma janela de ledger R160 e um agregado independente restrito à mesma execução privada.

O módulo `ops/faisca/openai/private-provider-aggregate-audit.mjs` não tem rede, acesso a chaves, arquivos, log, mensagens ou qualquer efeito operacional. Aceita `before` e `after` com schema R160, `outcome` igual a `success`, `failed_luna`, `failed_terra` ou `rejected` e um agregado **somente do ensaio isolado**, com os campos exatos `schema`, `scope`, `lunaRequests`, `terraRequests`, `totalRequests`, `actualCostMicros`, `publicReady:false`, `operationalEffects:false`.

`scope` deve ser `isolated_private_review_only`. **Não use exportação da conta inteira, respostas, prompts, IDs do usuário, chaves, notas fiscais ou qualquer dado real** em testes ou PRs. Um agregado informado pelo operador pode ser falso ou incompleto e não é atestado criptograficamente; comparar contagens NÃO estabelece que a API ou o faturamento foram conciliados.

## Política de bloqueio
- Uma rejeição antes do modelo deve corresponder a zero reserva local e zero chamada no agregado.
- Um erro após Luna: uma reserva e no máximo a Luna. Um erro após Terra: duas reservas e ambas as etapas.
- Uma resposta positiva: duas reservas, uma Luna e uma Terra, sem adicionais.
- Qualquer rollback/deriva no ledger, contagem fora da janela ou gasto efetivo acima do reservado retorna `BLOCKED_*`. Não reembolsa nem repete chamadas.
- Mesmo quando as contagens conferem, retorna `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW`, **nunca** `providerUsageReconciled:true`, `externalAttestationVerified:true` ou `publicReady:true`.

## Teste reproduzível de laboratório
```bash
node --test tests/faisca-r165-provider-aggregate-audit.test.mjs
npm test
```
As fixtures não incluem dados reais nem chamadas ao provedor. A execução privada autorizada com conciliação independente, as diferenças entre preço estimado e faturado, múltiplos processos/hosts e o teste na VPS permanecem gates futuros. Esta entrega não toca no mascote, site público, Portal/Sites operacional, `main`, DNS ou VPS. Preservar `publicFaiscaEnabled=false`. R92/manual e teste pago anterior não precisam ser repetidos para esta auditoria offline. Nenhum GO público.
