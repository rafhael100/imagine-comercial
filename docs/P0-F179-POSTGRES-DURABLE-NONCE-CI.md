# P0 F179 — Prova de uso único em PostgreSQL real e descartável

A F176/F177 introduziu HMAC e reserva de nonce em memória, que **não comprova** exclusividade quando existem múltiplas instâncias HTTP. A F179 executa a mesma função verificadora contra uma tabela PostgreSQL real, exclusivamente no banco efêmero `imagine_comercial_ci` do runner GitHub Actions, para comprovar que uma `UNIQUE` impõe uma reserva lógica entre processos independentes.

O teste cria schema **somente de laboratório** `imagine_budget_proof_ci`, tabela `claimed_nonce` com unicidade de nonce, e faz doze verificações concorrentes com doze comandos `psql` independentes. Apenas uma transação pode inserir; onze devem retornar replay. Repetir o mesmo token, mudar origem e usar prova expirada não criam novos registros. A CI exige `GITHUB_ACTIONS=true`, runner `github-hosted`, `IMAGINE_EPHEMERAL_PG_TEST=1` e ausência de quaisquer variáveis de host/usuário/senha de banco externas. O banco completo é destruído pelo mecanismo F51 de cleanup ao final.

O ensaio foi incorporado em `scripts/test-postgres-ephemeral-ci.sh` logo após o HTTP→PostgreSQL F96. Nenhuma migration de runtime, rota, tabela de cliente ou ambiente da Leaseweb foi alterado. Mesmo um resultado verde **não comprova** proteção distribuída de produção: a aplicação final exigirá papel SQL de privilégio mínimo, claim atomicamente vinculado ao escopo/tenant, expiração e limpeza, réplica/backup/rollback, revisão de concorrência, LGPD, autenticação Portal e ACK real de CRM.

A resposta da biblioteca continua `durableReplayPreventionProven=false` e `canDeploy=false`. Isto é uma **prova técnica de PostgreSQL temporário**, não um formulário de orçamento operacional.
