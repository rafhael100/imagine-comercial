# Faísca R171 — SHA-256 independente para os três arquivos da auditoria privada

**REVIEW ONLY / NO-GO público.** Continuação da R170 #648 e do comparador offline R167–R169.

## Problema e correção

A R169 impede tipos inseguros, hardlinks e substituição de inodes durante uma mesma leitura; não impede um atacante de **alterar três JSON numéricos plausíveis antes da auditoria**. O comparador continuaria retornando `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW` para certas falsificações coerentes.

A R171 permite informar `expectedSha256` com **exatamente** `before`, `after` e `aggregate`, cada um com SHA-256 hexadecimal minúsculo de 64 caracteres, calculado sobre bytes canônicos incluindo LF final. Cada arquivo é conferido nas duas passagens de leitura da R169, sem admitir campos adicionais, links, permissões amplas ou mensagens arbitrárias. Diferença em qualquer arquivo causa erro genérico, sem divulgação de caminhos, hashes ou payloads.

O script privado existente `scripts/faisca-private-provider-offline-audit.mjs` agora exige `FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON`, JSON com esses três hashes, **fornecido pelo operador a partir de canal independente e previamente revisado**. Ausência ou JSON inválido bloqueia. O comparador de baixo nível sem pins continua disponível apenas para cenários de fixtures anteriores na CI, preservando a cadeia dos testes.

## Procedimento privado para revisão humana (NÃO executado na VPS)

1. Em ambiente autorizado e distinto da pasta de evidências, custódia confiável registra SHA-256 dos bytes de `before.json`, `after.json` e `aggregate.json`, além de origem, horário, escopo e SHA do checkout. Não gerar pins retrospectivamente a partir dos três arquivos já suspeitos.
2. Operador recebe os três hashes por **canal confiável independente**, não por `aggregate.json`, GitHub, navegador do Faísca ou comando que imprima conteúdo sensível. A autenticidade desse canal **não é validada pelo código**.
3. Em checkout privado limpo e na HEAD completa revisada, definir somente no shell privado as variáveis `FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY`, `FAISCA_PRIVATE_PROVIDER_AUDIT_ACK=YES_OFFLINE_NUMERIC_REVIEW_ONLY` e `FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON` no esquema `{"before":"<sha256>","after":"<sha256>","aggregate":"<sha256>"}`. Não copiar valores reais para tickets, PRs ou CI.
4. Executar `node scripts/faisca-private-provider-offline-audit.mjs <HEAD_SHA_40_HEX> success` (ou `rejected`, `failed_luna`, `failed_terra` conforme o teste). O código exige checkout limpo, SHA exata, não-CI e permissões privadas. `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW` termina **sempre com código 2**; divergências terminam com código 1; nunca código 0 de publicação.
5. Independente disso, operador compara consumo/uso com evidência legítima da OpenAI, verifica intervalo, projeto, modelos e custo efetivo e solicita AppSec/LGPD/FinOps/editorial. Nenhum dado real, chave ou relatório bruto deve ser exportado para GitHub.

## Testes executáveis

```bash
node --test tests/faisca-r171-independent-evidence-pins.test.mjs
npm test
```

O teste prova vínculo dos três hashes, adulteração de números ainda plausíveis, formato rígido de pins e falha segura da CLI. Testa apenas fixtures, sem chamadas OpenAI, VPS, DNS ou dependências operacionais.

## Limites de garantia

SHA-256 independente prova correspondência com bytes previamente pinados, **não** a legitimidade da fonte, custo faturado, completude do agregado, identidade do operador ou integridade multi-host. Um arquivo falsificado antes da coleta confiável do hash continuará falsificado com hash válido. A R95+ não foi homologada nesta entrega; a homologação R92 e o teste pago anterior informado pelo usuário não são repetidos. Nada altera `main`, site público, mascote aprovado, `publicFaiscaEnabled=false`, CRM, Portal/Sites operacional, VPS ou DNS.
