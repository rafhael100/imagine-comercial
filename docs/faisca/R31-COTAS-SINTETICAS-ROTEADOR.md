# Faísca R31 — cotas por conversa e por runtime antes do provedor simulado

**Base:** R30 [#494](https://github.com/rafhael100/imagine-comercial/pull/494). **Status:** laboratório de roteamento simulado, sem IA externa ou despesas.

## Motivação

A R09 já possui idempotência, `maxEntries`, timeout e um provedor explicitamente **`simulated`**. Entretanto, `maxEntries` limita o número de operações guardadas, não o número de despachos que um futuro provedor poderia executar. Antes de uma IA real, a integração exigirá limites efetivos de requisições, concorrência, tokens e orçamento.

Esta etapa acrescenta um **controle executável de admissão para laboratório**, sem escolher fornecedor, moeda, preço por token ou teto financeiro em nome do titular.

## Implementação

`ops/faisca/model-router/synthetic-quota.mjs` define `faisca.synthetic-route-quota.v1`:

- O host cria um objeto confiável com os dois parâmetros fechados `maxTotal` (1–256) e `maxPerConversation` (1–64, sem exceder total). Um objeto forjado ou campos com getters são recusados.
- Cada **novo despacho ao provedor simulado** consome exatamente uma unidade do limite total e do limite da conversa. A contagem é síncrona e em memória, compartilhável entre instâncias de runtime se o host passar o mesmo objeto.
- Replay do mesmo `messageId` não gasta novamente; uma tentativa recusada preserva a mesma recusa no replay. Pergunta privada, dado sensível, ausência de fonte e orientação fixa **não gastam quota**.
- Se a quota acabar, o runtime retorna `status=limit` e `reason=synthetic_quota_exhausted`, com `route=null` e **nenhum despacho**. Não é gerado texto factual ou ação de negócio.
- Timeout, falha do simulado, resultado incerto e destruição **não reembolsam** uma unidade despachada: o custo de uma eventual chamada real não poderia ser considerado zero apenas porque a resposta não chegou.
- `quota.inspect()` expõe somente contagens e limites agregados, sem texto de usuário, identificador de conversa, credenciais ou payload. Mostra `moneySpent=false` e `externalModelInvocations=0`.
- Se o host **não** fornecer quota, o runtime R09 mantém o comportamento anterior e seus contratos/testes permanecem idênticos. O modo continua aceitando somente `provider.kind=simulated`.

## Provas

`tests/faisca-r31-synthetic-route-quota.test.mjs` cobre:
1. limites inválidos, instâncias forjadas e getters hostis;
2. duas sessões, replay idempotente, recusa por conversa/total;
3. perguntas de suporte, fonte ausente e PII sem cobrança de unidade;
4. timeout e reconciliação sem redispatch ou reembolso automático;
5. quota compartilhada entre duas instâncias do runtime, sem uso externo ou custo.

O workflow Faísca roda essa regressão junto às demais suites de Node, Chromium, PHP pinado e Comercial/SEO. **CI verde na SHA desta PR** é obrigatória.

## O que continua bloqueado

Esta é uma cota **sintética e volátil**, não um sistema durável de cobrança/rate limiting ou autorização de orçamento real. Antes de ligar um provedor comercial, será preciso:

- fornecedor, modelo e região aprovados;
- política LGPD/DPA, tratamento de dados, retenção e informação ao visitante;
- credenciais em vault exclusivamente no servidor;
- controle distribuído/durável de tokens e gasto diário/mensal, preços versionados, reservas/conciliadores, alerta e desligamento automático;
- revisão independente, testes de abuso, custos de pior caso, staging protegido e autorização de GO.

Não foram criados acessos, modelos pagos, chaves, endpoints de IA, chamadas externas, checkout, CRM, Portal ou alterações no mascote/site público. Todas as PRs permanecem em revisão.
