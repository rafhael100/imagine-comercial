# Faísca R161 — bloqueio por delta do ledger na sequência privada

A R160 disponibilizou snapshots locais somente leitura. A R161 faz a sequência
R157 comparar **três** leituras do mesmo ledger durável: antes de qualquer
HTTP, depois do POST fictício rejeitado e depois do POST fictício permitido.

O gate opcional `inspectLedger` na função Node exige formato R160 estrito,
mesmos limites e contadores monotônicos, **zero reservas e zero custo estimado
na rejeição**, depois **exatamente duas reservas e aumento positivo do valor
reservado** após a resposta positiva. Se o ledger for inválido, bloqueado,
indisponível, tiver limite alterado ou houver qualquer delta inesperado,
o relatório registra `BLOCKED_LEDGER_GATE`. Um erro no gate negativo impede
a segunda pergunta e portanto qualquer tentativa positiva de modelo.

A CLI de operador `scripts/faisca-private-staging-sequence.mjs` agora exige
esse gate para o caminho privado autorizado, com as mesmas configurações
efetivas de ledger da aplicação e um ACK explícito. O código **não** obtém
chaves, não abre portas, não reinicia, não faz deploy, não altera as cotas, não
remove locks, não registra mensagens, não executa automaticamente na VPS e
não chama o provedor nesta entrega. Se o operador já homologou R92, não
precisa repeti-la. R95–R161 não são presumidas instaladas.

## Procedimento do operador, somente quando staging estiver revisado

Após obter por **canal independente** a HEAD SHA revisada e conferir o
checkout limpo em ambiente privado, usar os valores **já provisionados** no
servidor para `FAISCA_PRIVATE_LEDGER_MAX_REQUESTS` e
`FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD`, sem reconfigurar cotas existentes.
Nenhuma chave OpenAI deve ser enviada ao script ou ao repositório.

```bash
export FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY
export FAISCA_PRIVATE_SEQUENCE_ACK=YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS
export FAISCA_PRIVATE_LEDGER_AUDIT_ACK=YES_LOCAL_READONLY_NO_PROVIDER_PROOF
export FAISCA_PRIVATE_LEDGER_DIRECTORY=/caminho/privado/ledger
export FAISCA_PRIVATE_LEDGER_MAX_REQUESTS=<limite_efetivo_da_aplicacao>
export FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD=<orcamento_efetivo_da_aplicacao>
# FAISCA_REVIEW_BEARER_TOKEN deve estar provisionado no ambiente privado,
# nunca publicado nem copiado para o terminal ou GitHub.
node scripts/faisca-private-staging-sequence.mjs <SHA-revisada-de-40-caracteres>
```

O operador deve pausar qualquer tráfego concorrente de IA no mesmo host
antes da comparação; a leitura R160 não é transacional e não autentica
o processo que gerou uma reserva. Testes CI apenas simulam a conversa e
reservas locais; `localLedgerDeltasVerified=true` **não significa**
`ledgerReconciled=true` nem prova que houve duas chamadas à OpenAI.
O relatório mantém `providerTransportVerified=false`,
`modelCallsProvenExactlyTwoForPositive=false` e
`publicReady=false`. Confrontar separadamente a trilha do provedor, uso
e registros de operação privada; nunca inserir faturas, segredos ou dados
de clientes no GitHub.

## Testes executáveis

```bash
node --test tests/faisca-r161-private-ledger-sequence-proof.test.mjs
node --test tests/faisca-r157-private-staging-sequence.test.mjs
node --test tests/faisca-r158-durable-model-sequence.test.mjs
```

Os testes R161 usam HTTP de loopback real, servidor privado com respostas
fictícias e um diretório ledger 0700 descartável. Exercitam sucesso
(0+2 reservas), gasto inesperado antes da positiva, reserva faltante e
falha de leitura que impede o segundo POST. Não há dados reais, OpenAI real
ou consumo pago.

**HOLD público:** revisão independente AppSec, LGPD, FinOps e editorial,
homologação R95–R161 por operador e conciliação real de uso/ledger/provedor
ainda pendentes. `main`, mascote, site público e
`publicFaiscaEnabled=false` preservados; sem merge, deploy, DNS, VPS,
CRM/Portal/Sites operacionais, leads, tickets ou cobranças.
