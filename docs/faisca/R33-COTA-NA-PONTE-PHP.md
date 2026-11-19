# Faísca R33 — cota de despacho aplicada ao pipeline R09→R06/PHP

**Base:** R32 [#496](https://github.com/rafhael100/imagine-comercial/pull/496). **Status:** revisão em laboratório, sem conexão externa.

## Por que

A R31 criou uma quota sintética de despachos no runtime isolado R09. Entretanto, a jornada de respostas fundamentadas do Faísca utiliza `createGroundedModelPipeline`: roteamento R09 → verificação editorial R06 → resposta validada. Para que a futura proteção de recursos não seja ignorada no caminho mais importante, a quota opcional também precisa ser recebida por esse pipeline.

## Código implementado

`ops/faisca/model-router/grounded-pipeline.mjs` ganhou o parâmetro opcional `routeQuota`, repassado somente ao roteador R09 confiável. Nenhum outro contrato foi alterado:

- O roteador recusa instâncias de quota forjadas e provedores externos;
- antes de um novo despacho simulado, uma unidade é reservada por conversa/total;
- uma recusa `status=limit` encerra a operação com texto fixo, sem chamada ao verificador R06/PHP;
- mesmo `messageId` retorna a decisão original, sem novo despacho;
- mensagens privadas, credenciais e ausência de conteúdo editorial permanecem locais, sem usar quota;
- timeout ou falha não causam reembolso nem segundo despacho automático;
- uma única quota compartilhada pode limitar várias instâncias do pipeline em um mesmo processo;
- sem `routeQuota`, toda a compatibilidade R09–R12 é preservada.

A unidade contabilizada é apenas **tentativa de roteamento simulada**. Não corresponde a dinheiro, tokens, chamada de API externa ou cálculo real de custo. A operação continua `externalModelInvocations=0` e `operationalEffects=false`.

## Testes

`tests/faisca-r33-pipeline-route-quota.test.mjs` executa:
1. primeiro roteamento comercial e fundamentação R06 simulada aprovados, segundo bloqueado sem PHP;
2. replay, conciliação, privacidade e ausência de fonte sem consumo extra;
3. timeout conservador com recuperação do mesmo resultado;
4. quota compartilhada entre duas instâncias;
5. rejeição de objeto de quota falso e de provedor `external`.

A CI precisa aprovar a SHA exata R33, incluindo testes de privacidade R32, quotas R31, HTML público sem Faísca R26, R29 portátil no Chromium, R06/PHP pinado, SEO e PostgreSQL descartável.

## Gates operacionais que permanecem

O pipeline é simulado, não uma autorização de gastos. Para IA real, ainda serão obrigatórios autorização de provedor/modelo, orçamento diário/mensal, consumo/tokenização medidos e conciliados com a fonte oficial, registro durável entre workers, segregação por tenant sem confiar no browser, alertas, limites de concorrência, privacidade/LGPD, segredo em vault, revisão independente e GO de produção.

Sem API externa, chave, custo, lead, pagamento, contrato, pedido, CRM, Portal, DNS/VPS, merge em `main` ou alteração do mascote.
