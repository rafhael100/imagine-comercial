# F85 — Ledger de metadados de orçamento em PostgreSQL real descartável

## Objetivo
Avançar o bloqueio F70 com uma prova de **mecanismos reais de PostgreSQL**, sem abrir formulário público, conectar o CRM ou introduzir dados pessoais. A F85 complementa F77–F81, que simulavam idempotência apenas em memória, demonstrando em um banco PostgreSQL novo do runner GitHub Actions as restrições que um futuro receptor de leads precisa adotar.

## O que o CI executa de fato
- Usa o banco `imagine_comercial_ci`, **criado somente pela rotina F51**, que recusa hosts externos e bancos preexistentes. O novo teste F85 revalida `GITHUB_ACTIONS=true`, `RUNNER_ENVIRONMENT=github-hosted`, `IMAGINE_EPHEMERAL_PG_TEST=1` e ausência de `PGHOST`/`PGHOSTADDR`/`PGSERVICE`.
- Aplica apenas `tests/sql/lead-idempotency-ephemeral.sql` ao banco descartável já aberto. **Não adiciona migration deployável** em `db/migrations`. Dois papéis sintéticos `NOLOGIN`, `NOBYPASSRLS`, diferentes, têm filtros RLS fixados em UUIDs de organização fictícia.
- Tabela contém apenas oito colunas: organização, submissão, vínculo, site, formulário, destino (todas UUID), estado e versão. Sem nome, telefone, e-mail, mensagem, consentimento, IP, cookies ou conteúdo comercial.
- Testa UNIQUE real `(organization_reference, submission_reference)`, inclusive com **mesmo UUID de submissão em empresas diferentes**; um segundo destino com mesma chave lógica não cria entrada.
- Verifica `FORCE ROW LEVEL SECURITY`, consultas cross-tenant vazias, INSERT cross-tenant rejeitado, UPDATE cross-tenant impedido, tentativa de falsificar um parâmetro `app.lab_tenant_id`, negação de DELETE/TRUNCATE e proibição de alterar as seis referências imutáveis.
- Dispara **duas conexões PostgreSQL concorrentes** com compare-and-swap `WHERE state='open' AND version=0`; exige exatamente um vencedor, estado final `reserved|1` e replay obsoleto sem efeito.
- O script pai descarta banco e papéis no `trap` já existente; nenhum dado é transferido à VPS Leaseweb. Falhas fazem o CI ficar vermelho, sem fallback.

## Arquivos
- `tests/sql/lead-idempotency-ephemeral.sql`: fixture técnica e permissões RLS.
- `scripts/test-lead-metadata-postgres-ephemeral-ci.sh`: testes SQL reais no PostgreSQL do runner descartável.
- `scripts/test-postgres-ephemeral-ci.sh`: ponto único de integração F51 + F85 e limpeza dos papéis.
- `tests/lead-metadata-pg-ci-boundary.test.mjs`: travas de regressão para evitar relaxar a execução ou acrescentar dados pessoais.

## O que NÃO está implementado
Esta evidência valida restrições físicas de uma **fixture descartável**, não um serviço operacional de captura, autenticação do Portal, sessão/MFA, tenant resolvido no backend, prova LGPD, limitação de taxa, CAPTCHA/desafio, outbox, fila, recibo remoto assinado, recuperação após perda de conexão, backups ou criptografia de contatos.

Os papéis de duas organizações são definidos **estaticamente** pela fixture; não são esquema de autenticação de produção. Um administrador privilegiado do banco de teste sempre pode alterar os registros, como esperado. A aplicação real exigirá revisões SEG/DBA e testes de transação com permissões e vínculo de identidade aprovados.

F70 permanece bloqueado. Nenhum formulário é ativado, nenhuma migration é enviada à VPS, nenhum merge de `main`, DNS ou deploy foi executado. Os testes não geram novos contratos com fornecedores.
