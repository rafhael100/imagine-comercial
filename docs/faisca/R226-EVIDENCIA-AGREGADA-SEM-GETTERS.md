# Faísca R226 — capturar evidência agregada sem executar getters

## Lacuna identificada

A auditoria R165/R225 capturava de forma imutável os dois snapshots locais de reservas, porém continuava lendo `evidence.totalRequests`, `evidence.actualCostMicros` e outros campos da evidência externa diretamente. Um objeto recebido do inspetor com getters, símbolos, propriedades ocultas ou um Proxy adversarial podia executar código durante a inspeção, alterar valores entre leituras ou lançar erros contendo material privado.

## Correção de laboratório

`private-provider-aggregate-audit.mjs` agora extrai uma única observação de **oito propriedades próprias de dados**, usando descritores, e rejeita accessors, propriedades extras (inclusive símbolos), formatos inconsistentes e introspecções que lançam erro. A cópia validada é congelada e todas as decisões de contagem/custo usam exclusivamente essa cópia. As duas observações do ledger continuam capturadas independentemente (R224/R225). A falha é `BLOCKED_INVALID_EVIDENCE`, sem lançar a mensagem de erro do inspetor.

## Reproduzir com fixtures

```bash
node --test tests/faisca-r226-provider-aggregate-evidence-descriptors.test.mjs
node --test tests/faisca-r165-provider-aggregate-audit.test.mjs tests/faisca-r225-provider-aggregate-alias.test.mjs
```

Os testes novos cobrem oito getters (sem executá-los), getter que lança erro privado fictício, símbolo, propriedade não enumerável, chave estranha, Proxy que lança erro e casos numéricos legítimos. A CI de laboratório mantém Node/HTTP/Chromium/axe, SEO/build e outros gates do repositório.

## Limites e bloqueios

Este endurecimento não comprova proveniência do agregado OpenAI nem autenticidade de fatura, atomicidade entre processos, conciliação externa ou instalação em VPS. Nenhum dado ou chave real foi usado. A homologação acumulada privada e as revisões AppSec/LGPD/FinOps/editorial seguem necessárias. **Não é GO público**: não alterar `main`, mascote/site público, `publicFaiscaEnabled=false`, infraestrutura, DNS, CRM, Portal/Sites operacionais, nem realizar merge, deploy, cobranças, leads ou tickets.
