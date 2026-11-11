# F49 — Ledger atômico PostgreSQL anti-replay (adaptador sem conexão)

A função `createPostgresWitnessReplayLedger(db)` recebe uma instância `pg.Pool`/`pg.Client` já autorizada pela camada de infraestrutura. Este repositório **não conecta banco, não cria credenciais nem executa migrações automaticamente**. O método `reserveOnce` é compatível com F41 e executa uma única consulta parametrizada `INSERT ... ON CONFLICT DO NOTHING RETURNING ...`. O índice `PRIMARY KEY (witness_key_id, nonce)`, proposto no arquivo `db/migrations/001-witness-replay-nonce.sql`, é indispensável à atomicidade entre processos.

A primeira inclusão devolve `true`; conflito devolve `false`; indisponibilidade, entradas malformadas e confirmações inconsistentes produzem erro (F41 converte falhas em bloqueio). Não há `SELECT` prévio, armazenamento em memória alternativo, envio remoto, eventos, dados de clientes ou gatilhos de publicação.

## Para homologação privada, ainda não executada
1. Revisar e aplicar migração manualmente somente em banco de staging isolado.
2. Configurar papel PostgreSQL limitado e TLS/segredos pelo serviço de infraestrutura, fora do repositório.
3. Exercitar reserva e conflito **contra PostgreSQL real** em teste de integração privado, inclusive concorrência multiprocesso e recuperação de falhas.
4. Aprovar retenção, backups, limpeza por idade com janela de replay, observabilidade sem dados pessoais e rotação de credenciais.
5. Conectar o adaptador à política F45/F47 somente depois de origem independente dos pins, witness remoto, MFA/grants e autorização do responsável.

Os testes do PR usam apenas clientes falsos em memória e **não provam persistência em PostgreSQL real**. Deploy, DNS, Cloudflare, main e custos permanecem intocados.

Teste: `node --test tests/postgres-witness-replay-ledger.test.mjs`.
