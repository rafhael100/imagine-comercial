# F86 — Transação real de reserva + outbox de metadados (CI descartável)

## O problema tratado
Para que um orçamento não se perca entre a primeira gravação e o processamento assíncrono, o Portal precisa futuramente de uma **gravação transacional** de registro idempotente e evento de saída. A F85 demonstrou unicidade, RLS e compare-and-swap em PostgreSQL descartável; a F86 amplia essa prova para uma operação SQL atômica com outbox.

## Evidências reproduzidas em PostgreSQL real do GitHub Actions
- `tests/sql/lead-outbox-ephemeral.sql` cria uma tabela apenas no schema `imagine_comercial_lead_ci` já aberto pela F85. Guarda **organização UUID, submissão UUID, tipo de evento `pending_review` e horário do banco**; não guarda dados de contato nem payload.
- `FOREIGN KEY (org, submissão)` conecta o evento ao registro já existente. `PRIMARY KEY (org, submissão, tipo)` evita eventos duplicados. RLS `FORCE` e políticas fixas de empresas fictícias separam consultas e escritas.
- Um comando SQL `WITH reserved AS (UPDATE ... RETURNING ...)`, seguido por `INSERT INTO metadata_outbox ... SELECT ... FROM reserved`, opera como uma **única instrução transacional PostgreSQL**. Nenhuma rotina chama a rede.
- Uma tentativa com tipo de evento inválido falha por `CHECK`; o teste confirma que **a reserva também foi revertida** (`open|0`) e nenhum evento foi enfileirado.
- Em um caso válido, um único evento `pending_review` acompanha a reserva `reserved|1`. A repetição idêntica não gera outro evento, e inserções duplicadas ou sem registro pai falham.
- A empresa B não enxerga eventos da A e não consegue inserir um evento falsificando a organização. O papel de teste não pode alterar, excluir ou truncar eventos.
- Toda a execução é obrigatoriamente CI hospedado pelo GitHub, no banco temporário já provisionado pela F51. O banco e os papéis são descartados pelo script pai.

## Escopo que NÃO foi provado
O registro com `pending_review` **não significa que o CRM recebeu ou processou um lead**. Não existe worker, API de entrega, autenticação de serviço, assinatura, confirmação assinada do destino, reconciliação com duas infraestruturas, retenção, TLS de produção, antifraude ou observabilidade operacional. Os campos são apenas UUIDs fictícios, estado e relógio do PostgreSQL.

**Alerta de autorização:** os papéis da fixture recebem permissão de `INSERT` na outbox para testar RLS/constraints, mas essa concessão isolada não impede enfileiramento por outra instrução independente. A integração real deverá encapsular reserva+evento numa operação autenticada, com permissões executáveis mínimas e revisão SEG/DBA, em vez de copiar os grants do laboratório. Não há transação distribuída ou garantia de entrega exatamente uma vez entre sistemas.

## Próximo gate F70
Para lançar o formulário real, ainda faltam a autenticação do vínculo Portal/tenant, consentimento registrável e privacidade, endpoint/API, antispam e rate limit, outbox persistida com worker e recuperação, recibo do CRM, testes de homologação na VPS isolada, revisão independente e equivalência do atendimento do legado.

Nenhuma migration de produção foi adicionada a `db/migrations`. O formulário público segue desativado, PR draft somente, sem `main`, DNS, deploy, gastos ou dados pessoais de clientes.
