# F51 — PostgreSQL REAL em CI isolado, sem VPS e sem dados reais

O GitHub-hosted Ubuntu 24.04 oferece o binário PostgreSQL e serviço local desligado. O novo job levanta o banco **somente no runner descartável**, recusa bancos e papéis preexistentes e, após o teste, remove exclusivamente a base criada para o CI. Não usa Docker, credenciais externas, Leaseweb nem rede para um servidor da Imagine.

O teste executa efetivamente a migração SQL F49 duas vezes e os INSERTs reais via `psql` e `PREPARE` usando a mesma instrução `INSERT_WITNESS_NONCE_SQL` do adaptador de produção. Abre diversas sessões concorrentes; exige exatamente uma reserva de nonce por witness, conflito para replays, nova sessão com leitura de estado persistido, aceitação de outra chave/nonce, recusa de valores inválidos e bloqueio de DELETE por papel sem esse privilégio.

O shim de teste só concatena fixtures geradas no próprio CI e rigorosamente validadas; **não é driver de produção**. Na VPS, a conexão deve ser feita por um cliente PostgreSQL com parâmetros realmente vinculados e autorização do Portal. Os checks aqui demonstram o SQL real e a constraint em um runner descartável, mas **não** provam segurança/continuidade, retenção, backup, permissões, infraestrutura, witness ou operação da VPS Leaseweb.

O runner impõe `GITHUB_ACTIONS=true`, `RUNNER_ENVIRONMENT=github-hosted` e `IMAGINE_EPHEMERAL_PG_TEST=1`; se qualquer condição faltar ou variáveis de host remoto aparecerem, falha fechada.

Apenas a migração do banco **novo e temporário do CI** é permitida automaticamente neste job. A migração em banco permanente de staging ou produção continua condicionada à autorização específica e homologação no [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56). Não houve merge em main, deploy, DNS nem despesas novas.
