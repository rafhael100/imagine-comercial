# R288 — CLI offline, agregados sintéticos e nenhuma escrita

**Base:** R287 #767, HEAD `b589af4e2be4f627456708b1644fccaaf34f2f04`.

O CLI `scripts/faisca-private-usage-review.mjs` utiliza o ledger já existente com `inspectReadOnly()` e o comparador R287. Só aceita JSON numérico estrito via **stdin**, diretório absoluto e os limites originais do ledger. **Não conecta ao provedor, não valida autenticidade do faturamento, não consulta Docker/VPS e não altera arquivos.** Não cria nem resolve NO-START, não reseta contador e nunca libera produção.

## Execução de laboratório por operador autorizado (dados fictícios)

```sh
# Somente ambiente isolado autorizado. Não apontar para armazenamento real em CI.
printf '%s\n' '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200}' |
  FAISCA_PRIVATE_OPERATOR_USAGE_REVIEW=REVIEW_ONLY \
  node scripts/faisca-private-usage-review.mjs \
    --directory=/caminho/absoluto/privado/0700 \
    --max-requests=4 --max-budget-usd=1
```

O diretório deve existir, ter proprietário/permissões seguros e corresponder a **um ledger autorizado**, com parâmetros originais exatos. A opção ambiental não é uma autorização para acessar a VPS; exige prévia permissão operacional. Se faltar informação, o comando falha sem imprimir paths, JSON fornecido, chaves, e-mail ou detalhes internos.

Não enviar dados reais de cliente, tokens, IDs de conta, screenshots de faturamento, prompts ou extratos para CI/GitHub. Número fornecido por humano **não é recibo verificado**, ainda que coincida com o saldo reservado. Se houver reservas ativas, incerteza, falta de conciliação independente ou divergências, manter HOLD para o custodiante. A execução não substitui auditoria FinOps, AppSec/LGPD/editorial ou prova Docker/PID/HTTP da instalação R95 em staging.

## Testes

```sh
node --test tests/faisca-r287-private-usage-review.test.mjs tests/faisca-r288-offline-usage-review-cli.test.mjs
npm test
```

O E2E inicia **subprocessos Node**, faz reservas reais em pasta de CI 0700 descartável, compara os arquivos byte a byte antes/depois e prova ausência de mutações, logs de entrada ou liberação pública. Chromium/axe/WCAG, SEO/build, Onepage/Portal, PostgreSQL efêmero e PHP seguem na CI de laboratório.

Respeitar homologação R92 e teste pago anterior; não repetir sem motivo. Preservar `main`, site, mascote e `publicFaiscaEnabled=false`. Sem deploy, merge, DNS, VPS, CRM/Portal/Sites operacional, chaves ou chamadas pagas nesta entrega. **PR DRAFT / NO-GO público.**
