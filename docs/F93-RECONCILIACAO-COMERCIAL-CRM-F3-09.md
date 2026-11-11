# F93 — Paridade de reconciliação Comercial × CRM F3-09

## Referência confirmada no CRM
O CRM Imagine implementa o classificador PHP `app/Core/Leads/SyntheticLeadReconciliationInspector.php`, com tipos `SyntheticReceiverObservation.php`, `SyntheticReceiverStatus.php` e `SyntheticReconciliationAssessment.php`, consultados na branch `dev/f3-16-postgres-nonce-replay-lab-2026-11-08`.

Ele considera observações sintéticas do receptor primário e do receptor de contingência, ambos identificados por **organização, vínculo e submissão**, e sinais alegados (não certificados) de entrega no CRM e resposta tardia. Não identifica sozinho site/formulário/destino, cuja imutabilidade exige as garantias separadas das F78/F80.

## Implementação
`src/lib/crm-reconciliation-parity-lab.mjs` implementa, em Node puro e sem I/O, a mesma ordem de precedência de classificações PHP:

1. Conflito de identidade da submissão e troca dos papéis primário/contingência.
2. Resposta tardia em conflito com expiração, ou resposta tardia que exige revisão.
3. Alegação de entrega com expiração, expiração divergente entre receptores e expiração a reconciliar.
4. Alegação de persistência CRM sem prova, duas alegações de durabilidade, uma alegação de durabilidade.
5. Duas falhas alegadas, uma falha alegada e ausência geral de recibo verificado.

O classificador rejeita objetos com campos extras, incluindo dados pessoais, identidades malformadas e status não previstos. Seu resultado devolve **apenas código diagnóstico** e mantém `canMarkDelivered`, `canScheduleRetry`, `canDeleteTemporaryPayload`, `canAcknowledgeVisitor`, `tenantAuthorized`, `crmPersistenceProven` e `deploymentAuthorized` sempre `false`.

`tests/crm-reconciliation-parity-lab.test.mjs` executa uma matriz de **64 combinações** (`4 status primário × 4 status contingência × 2 flags CRM × 2 flags de resposta tardia`) e casos de identidade, papel invertido, payload inesperado, UUID e flags inválidos. Também combina uma fixture HMAC válida F90 com duas alegações de durabilidade e resposta tardia, comprovando que o MAC consistente **não concede** confirmação de entrega.

## Limites
Os status são `unknown`, `durable_claimed`, `failure_claimed` e `expired_claimed` — todos apenas **alegações de laboratório**. Não existe receptor confiável, leitura do banco real do CRM, identidade autenticada no Portal, gestão de chaves, fila produtiva, confirmação assinada, outbox worker, processamento de dados pessoais ou consentimento homologado.

Esta entrega **não muda** a retenção real de dados, a F92 do PostgreSQL nem o gate F70 de captação pública. Para eventual recuperação de um resultado desconhecido, será necessária API autenticada do CRM que comprove persistência durável, autorização de pertença, reconciliação entre bancos e revisão SEG/DBA/LGPD. A F93 não libera reenvio ou exclusão de payload.

PR draft em branch isolada, sem alterar `main`, DNS, VPS, produção, credenciais ou despesas.
