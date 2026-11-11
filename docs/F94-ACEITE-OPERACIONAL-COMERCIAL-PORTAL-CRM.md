# F94 — Critérios executáveis de aceite para integração Comercial → Portal → CRM

**Estado:** REVIEW-ONLY. Este documento e a matriz F94 não habilitam endpoint nem certificam um ambiente. A referência foi construída com inspeção de código existente em 10/11/2026.

## Decisão de arquitetura

O **Imagine Comercial** continua sendo o site Astro público estático, sem captação ativa de dados de visitantes. O **Imagine Portal** deverá ser o receptor dos orçamentos com validação de formulário, antifraude, consentimento documentado e identificação de binding definida no servidor, não pelo navegador. O **Imagine CRM** será o destino da persistência e da confirmação definitiva, com idempotência própria e recibo verificável por uma identidade confiável.

O código em `imagine-portal/server/app.mjs` na branch `dev/portal-f73-lab-runtime-exposure-guard-2026-11-10` possui rotinas de sessão, CSRF e rate limiting para fluxos legados, **não** representa um receptor de orçamentos autenticado e homologado. O CRM nas branches F3-06, F3-09, F3-11, F3-12, F3-15 e F3-16 oferece validadores e testes sintéticos, sem prova de canal de recebimento operacional.

Um usuário externo pedindo orçamento não necessariamente possui login no Portal. Portanto, **autenticar o navegador com MFA não é uma exigência inventada**: o contrato deve diferenciar a entrada pública protegida contra abuso das credenciais *server-to-server* Portal → CRM e das permissões dos operadores. Nenhum ID de tenant no corpo enviado pelo visitante deve valer como autoridade.

## Código implementado

- `src/lib/portal-crm-operational-boundary.mjs`: 14 critérios de aceite com proprietário responsável e teste exigido, agrupando os laboratórios já existentes sem tratá-los como operação confiável.
- `scripts/report-launch-blockers.mjs`: o relatório offline F43 contém o bloco `portalCrmIntegration`, com 14 pendências operacionais, sem inventar avaliação de terceiros.
- `tests/portal-crm-operational-boundary.test.mjs`: garante proprietário e teste de cada requisito, confirmação explícita de que nenhum item foi verificado de forma independente, e os campos de autorização sempre falsos. A simulação de um usuário passando `approved:true` não pode alterar o resultado.

Este bloco de aceitação é apenas uma **lista verificável de pré-requisitos**; ele não é certificado nem transfere autorização. São necessários registros concretos de staging, auditoria, mecanismos de autenticação, recibos externos e revisão independente para substituir bloqueios com base em evidência operacional.

## Critérios que ainda impedem F70

1. Finalidade, minimização de dados, política de privacidade e eventual consentimento/bases legais por campo.
2. Endpoint HTTPS e defesa antiabuso: origem, rate limit, validação, bot, limites de tamanho, observabilidade sem dados pessoais.
3. Autenticação *server-to-server*, resolução de empresa/vínculo no servidor, revogação e segregação de privilégios.
4. Reserva idempotente transacional no banco **persistente** do CRM, fila outbox e consumidores mínimos com recovery.
5. Integridade com chaves rotacionáveis gerenciadas fora do repositório, proteção contra replay e confirmação de persistência obtida da fonte autoritativa.
6. Tratamento de timeout/partição/resposta tardia sem ACK falso e sem repetir automaticamente resultado desconhecido.
7. Retenção, backups, correção/exclusão, auditoria, revisão de SEG/DBA, QA staging e paridade do formulário antigo.
8. Aprovação explícita de lançamento e plano de rollback do responsável por produção.

A F83/F84 assegurou somente **6/7 correspondências visuais** do orçamento legado, sem verificar funcionamento, exigência de campos ou mecanismo antirrobô. Esse percentual não pode virar prontidão de produto.

## Próxima implementação conjunta necessária

O próximo trabalho efetivamente operacional precisa acontecer no Portal e CRM: contrato de entrada anônima com segurança, identidade do servidor para CRM, persistência, outbox persistida, recibo verificável e testes de integração em staging autorizado. Só então os requisitos poderão ser marcados individualmente como verificados pelo responsável, sem confiar em aprovações autodeclaradas por laboratórios.

Não houve captura real, uso de contatos, mudança em `main`, VPS, DNS, deploy ou novas despesas. A F70 permanece fechada.
