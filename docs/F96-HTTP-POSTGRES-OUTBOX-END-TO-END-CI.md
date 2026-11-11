# F96 — Integração de verdade entre HTTP local e PostgreSQL real descartável

## Objetivo
A F95 exercitou um receptor HTTP **somente em 127.0.0.1**, autenticado por chave efêmera, com F78 envelope de oito metadados e idempotência em memória. A F85/F86 exercitaram transação PostgreSQL real e outbox, mas sem fazer uma chamada HTTP. A F96 unifica os dois mecanismos **dentro de um único GitHub Actions efêmero**, sem ativar serviço público.

## Implementação
`tests/fixtures/private-loopback-intake-harness.mjs` passa a aceitar um **adaptador de observação injetado exclusivamente por testes**. Por padrão, todos os testes da F95 ainda usam Set de memória. No novo CI PostgreSQL, o adaptador é implementado por `scripts/test-lead-http-postgres-ephemeral-ci.mjs`, que executa `psql` somente na base `imagine_comercial_ci` criada do zero pelo script pai F51.

- O teste só é executado com `GITHUB_ACTIONS=true`, `RUNNER_ENVIRONMENT=github-hosted`, `IMAGINE_EPHEMERAL_PG_TEST=1` e sem configuração externa de host, usuário, porta ou banco PostgreSQL.
- O HTTP entra por `127.0.0.1:porta_aleatória/__lab/internal/lead-review`, com `Authorization: Bearer` criado na memória durante o teste. O serviço não é publicado ou importado por Astro.
- O corpo é validado pelo F78 (oito campos exatos, seis UUIDs). O receptor fixa organização, vínculo, site, formulário e destino. O script SQL converte exclusivamente UUIDs validados em literais, recusando qualquer campo extra.
- Uma única instrução PostgreSQL com `WITH created AS (INSERT ... ON CONFLICT DO NOTHING RETURNING ...), queued AS (INSERT ... SELECT ... FROM created)` executa a reserva e a criação de um evento `pending_review` **atomicamente**. Não grava contato, mensagem, recibo ou consentimento.
- Duas requisições HTTP concorrentes para a mesma organização e submissão devem produzir uma inserção e um resultado de repetição. O teste confirma no banco **1 ledger e 1 outbox**, sem duplicação; novas tentativas são reconhecidas como metadados já vistos, não como uma nova entrega.
- Troca do identificador de tenant, vínculo, site, formulário ou destino retorna `403`; dados de contato ou campos extras são rejeitados; falta de token retorna `401`. A transação fica em `open|0`, a fila em `queued|0|0`, sem simular confirmação do CRM.
- Todas as respostas carregam `crmPersisted:false`, `tenantAuthenticatedForProduction:false`, `visitorAcknowledgementAllowed:false`, `deliveryProven:false`, mesmo em HTTP 202. Resultado `202` **não** é comprovante de entrega durável.

## O que precisa acontecer nos outros repositórios

**Portal Imagine**: criar um receptor real privado e depois entrada pública de orçamento protegida contra abuso; implantar autenticação de serviço, tenant binding servidor, validação de dados pessoais, consentimento com fundamento e evidência legal, TLS, política de retenção e processamento de falhas.

**CRM Imagine**: persistir a submissão e a outbox num armazenamento real, controlar permissões por tenant, fazer integração/worker idempotente e fornecer uma confirmação de persistência verificável e reconciliável por uma API autenticada, mesmo se o navegador ou o Portal perder a resposta.

**Comercial**: só substituir o canal legado após staging independente, QA de acessibilidade, review de privacidade/segurança, comprovação de recebimento end-to-end e decisão explícita do dono do release.

## Limitações
F96 é uma prova técnica de integração **local e temporária** com metadados sintéticos. O código de teste usa `sudo -u postgres` no runner, o que **não é um desenho de privilégios de produção**. Não testa TLS/mTLS, autenticação real, HMAC com KMS, dados reais, armazenamento criptografado, filas contínuas, timeouts entre servidores, backups, perda de conexão, política antispam nem comprovação da entrega CRM. O código HTTP não deve ser copiado para produção.

A F70 continua fechada. Nenhum formulário público foi criado, nenhum dado pessoal foi usado e não houve `main`, deploy, DNS, VPS ou despesa nova.
