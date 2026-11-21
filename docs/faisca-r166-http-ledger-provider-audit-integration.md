# Faísca R166 — E2E auditado, HTTP privado + ledger + uso sintético

A R166 acrescenta regressões executáveis à R165. O teste instancia o servidor HTTP privado real em loopback, utiliza o adapter Luna/Terra com **transporte OpenAI simulado** e ledger R82/R160 num diretório descartável 0700, antes de comparar as contagens e o gasto estimado a agregados exclusivamente sintéticos.

## Cobertura
- Pergunta negativa fictícia rejeitada antes de qualquer chamada ao modelo.
- Pergunta positiva fictícia com exatamente dois POSTs HTTP privados no conjunto e duas tentativas do adapter (Luna e Terra), com duas reservas duráveis.
- Divergência nos agregados observados resulta em `BLOCKED_REQUEST_MISMATCH`.
- Gasto observado sintético acima do saldo reservado resulta em `BLOCKED_COST_EXCEEDS_RESERVATION`.
- Falha HTTP 503 simulada na Terra mantém as duas reservas, sem reembolso/retry.
- Mesmo com contagens coincidentes, a auditoria reporta somente `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW` e `providerUsageReconciled:false`.
- Relatórios não contêm token do servidor, segredo fictício, resposta nem prompts.

## Reprodução
```bash
node --test tests/faisca-r166-http-ledger-provider-aggregate.test.mjs
npm test
```

**Não é conciliação do faturamento da OpenAI**: os agregados de teste vêm de um transporte fictício, não de registros autenticados do provedor. CI e HTTP local não atestam a execução privada na VPS, dados reais, uso pago, isolamento multi-host ou prontidão comercial. Requer revisão independente AppSec/LGPD/FinOps/editorial, evidência do operador e homologação acumulada de staging. R92/manual e teste pago real anterior permanecem respeitados.

Nenhuma modificação em `main`, `src/`, `public/`, mascote, `publicFaiscaEnabled=false`, VPS, DNS, credenciais ou operações Portal/Sites/CRM. PR draft, sem deploy, merge ou GO público.
