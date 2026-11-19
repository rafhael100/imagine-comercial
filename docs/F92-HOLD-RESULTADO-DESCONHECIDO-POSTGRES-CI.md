# F92 — Retenção de resultado desconhecido e bloqueio de reenvio inseguro

**Status:** implementação de teste com PostgreSQL real **exclusivamente descartável** do GitHub Actions; sem serviço operacional e sem homologação de produção.

## Contexto

O contrato do CRM Imagine `SyntheticLeadReconciliationInspector.php` classifica observações de origem primária e contingência como não verificadas. Mesmo uma resposta HTTP 200/201, uma afirmação de recebimento durável ou uma resposta tardia não comprovam armazenamento real no CRM. O módulo F90 (HMAC) também não autentica a origem da chave nem garante que o CRM gravou o lead. A F91 separa nonces de recibos e idempotência lógica.

**Problema:** após timeout, deixar expirar o lease e repetir automaticamente a entrega pode criar um segundo efeito remoto quando o primeiro já foi processado. A F92 cria uma retenção (*hold*) em metadados para impedir esse reenvio sem reconciliação confiável.

## O que foi implementado no CI

- `tests/sql/lead-unknown-outcome-hold-ephemeral.sql`: tabela `unknown_outcome_hold` contendo somente organização UUID, submissão UUID, versão do claim e instante técnico do banco. A PK `(organization_reference, submission_reference)` limita a uma retenção por envio lógico; FK vincula ao registro sintético do ledger F85.
- `FORCE ROW LEVEL SECURITY` e `SELECT` de leitura para dois papéis de consumidores com escopos fixos A e B, sem permissões de `INSERT`, `UPDATE` ou `DELETE` diretas.
- Função `note_unknown_lab_a(uuid,bigint)` EXECUTE-only para o consumidor fictício A. Ela só registra a incerteza se o evento original está **claimed, com lease ativo e exatamente a versão de fencing recebida**. Repetição retorna `false`. Não aceita status arbitrário, afirmação de entrega ou UUID de outra empresa.
- Substituição **somente da função de teste** `claim_lab_a` da F89 por outra que consulta `unknown_outcome_hold` e recusa a próxima reserva se houver incerteza para o mesmo `(org, submission)`, mesmo que o lease anterior vença e ainda haja tentativas disponíveis.
- `scripts/test-lead-unknown-outcome-ephemeral-ci.sh`: verifica relato inválido antes de reservar, versão divergente, gravação única da retenção, papéis sem acesso cross-tenant, spoofing GUC rejeitado, ausência de UPDATE/DELETE direto, expiração simulada pelo proprietário de CI, **reclaim barrado**, manutenção do registro e possibilidade de processar outro envio independente sem contaminação do escopo.
- `tests/lead-unknown-outcome-pg-ci.test.mjs` protege as premissas e a execução sob CI. O banco temporário F51 é destruído ao final.

## Limites e ações futuras

A retenção não contém lead, destino real, ID de CRM, recibo, assinatura, consentimento, segredo nem PII. O marcador de resultado desconhecido **não equivale a sucesso nem a falha definitiva**. A integração operacional necessita de fonte confiável de evidência de destino, API de consulta/autenticação, reconciliação entre bases independentes, trilha de auditoria, observabilidade e tratamento de alertas e autorização explícita para remover retenções — *nada disso existe na F92*.

O teste usa `SECURITY DEFINER` com proprietário privilegiado somente na base efêmera. Em produção seria obrigatório um papel SQL restrito auditado, grants mínimos, controle de identidade e pertença no Portal, revisão SEG/DBA, antifraude e consentimento/LGPD.

**A F70 continua bloqueada.** Não foram ativados formulários, captura pública, deploy, `main`, DNS, VPS, nem despesas ou dados reais.
