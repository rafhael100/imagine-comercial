# R287 — comparação de gastos sintéticos para revisão humana (HOLD)

**Base revisada:** R286 #766, HEAD `9996ec91434c7a237a2c67614c99c3851c5ae19d`. **Ambiente:** laboratório privado, sem API real.

## Motivo

O ledger R82 registra o número de reservas e o limite **estimado** de gastos por processo/host; os dois números **não são faturamento da OpenAI**. Ainda não há prova operacional de que a versão R95–R287 esteja instalada na VPS. Não tratar saldos locais, HTTP 200, CI verde ou números digitados pelo operador como reconciliação independente.

## Novo incremento

`ops/faisca/openai/private-usage-review.mjs` compara um snapshot de `ledger.inspectReadOnly()` com **apenas dois agregados sintéticos, fornecidos pelo operador** (`requestCount`, `billedMicros`). Valida esquemas/forma de dados sem executar getters, rejeita campos extras (tokens, e-mail, conta, prompts), verifica limites inteiros e emite um relatório numérico imutável de três estados:

- `provider_exceeds_reservations`: mais chamadas/custo reportados que reservas, requer investigação.
- `reservations_without_reported_provider_calls`: menos chamadas reportadas que reservas; podem existir cobranças tardias/indisponíveis.
- `manual_verification_required`: totais compatíveis ainda **não** provam a autenticidade dos registros.

**Todos** os caminhos retornam `sourceVerifiedIndependently:false`, `providerUsageReconciled:false`, `canReleaseDurableFence:false`, `canResetQuota:false`, `publicReady:false`, `operationalEffects:false`. O módulo não consulta provedor, VPS, chave, DNS, Portal, Sites, CRM ou rede; não destrava NO-START nem altera saldo. Nenhum número digitado pelo operador equivale a recibo oficial.

## Testes

```sh
node --test tests/faisca-r287-private-usage-review.test.mjs
npm test
```

Testes com diretório temporário 0700 e **reservas reais no filesystem**, sem chamadas pagas, verificam que o relatório não altera um único byte do ledger, não reembolsa nem habilita atendimento, e rejeita campos extras, getters e números malformados. CI adicional continua responsável por Chromium/axe/WCAG, HTTP, SEO/build, PostgreSQL efêmero, Onepage/Portal e PHP nas HEADs.

## Operação futura — pendências explícitas

Para confrontar gastos reais, um custodiante deverá obter **por canal independente** os totais oficiais do provedor, a janela temporal, projeto e escopo de conta devidamente isolados. Não carregar recibos brutos, IDs de conta, tokens, prompts ou logs privados no GitHub. O confronto permanece **revisão humana**, inclusive quando números coincidem. Investigar chamadas in-flight, cobranças tardias, adiantamentos de reserva, relógio e retenção. A decisão de liberar marcador de incerteza, resetar quota ou mudar contratos exige processo operacional separado e auditável, **não** implementado por R287.

Respeitar homologação R92 e teste pago manual Luna/Terra informados. Não repetir sem necessidade. Sem merge, deploy, produção, mutação de VPS/DNS, cliente real, CRM/Portal/Sites operacionais ou publicidade. `main`, mascote e `publicFaiscaEnabled=false` preservados. **NO-GO público.**
