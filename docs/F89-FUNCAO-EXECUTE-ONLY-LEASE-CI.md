# F89 — Restrição EXECUTE-only para reserva da fila (CI PostgreSQL)

## Por que este incremento é necessário
Os testes F87/F88 já mostravam recuperação de leases e limite de três tentativas, mas os papéis fictícios de consumidores ainda tinham `UPDATE` direto nas colunas de estado. Um consumidor com comportamento malicioso poderia alterar `attempts` e contornar o limite. A F89 elimina essa permissão na fixture descartável **antes** de demonstrar uma nova sequência de claims.

## Implementação
`tests/sql/lead-outbox-execute-only-claim-ephemeral.sql` aplica, numa transação do PostgreSQL temporário:
- **REVOGA** UPDATE direto sobre `state`, `claim_version`, `attempts` e `lease_until` para os papéis de teste dos consumidores.
- Cria a função `imagine_comercial_lead_ci.claim_lab_a(uuid,bigint)` com `SECURITY DEFINER` e `search_path` restrito a `pg_catalog`, usando referências de tabela totalmente qualificadas e **organização sintética A fixada no SQL**.
- A função recebe apenas UUID de submissão e versão esperada, nunca um tenant arbitrário, texto livre, segredo, contato ou prazo editável. Só reserva eventos elegíveis, com `claim_version` esperado, lease vencida (ou `queued`) e `attempts<3`, aplicando uma duração fixa de 60 segundos.
- Revoga `EXECUTE` de `PUBLIC` e concede exclusivamente ao papel `imagine_comercial_lead_ci_worker_a`, tudo antes do `COMMIT`. **Não existe função de confirmação de entrega.**

O teste `scripts/test-lead-outbox-execute-only-ephemeral-ci.sh`, executado após F88 no banco recém-criado do GitHub Actions, verifica que: consumidores não podem fazer UPDATE/INSERT/DELETE na fila; o consumidor B não pode chamar a função A; referência de B não pode ser reservada por A; duas conexões concorrentes obtêm um único vencedor; versões antigas falham; após três expirações não existe quarta reserva e o consumidor não consegue resetar o contador; o evento permanece em análise no tenant original.

`tests/lead-outbox-execute-only-pg-ci.test.mjs` impede regressões nos privilégios, propriedades da função e no escopo do workflow.

## Limites fundamentais
Esta função é propriedade de um papel privilegiado do **banco de CI descartável**. Não se deve copiar diretamente `SECURITY DEFINER`, grants ou a organização fixa para um ambiente compartilhado/persistente. A versão real requer uma identidade operacional restrita não superusuária, autorização backend de tenant e vínculo, funções multiempresa que não aceitem tenant adulterável, revisão independente SEG/DBA, auditoria de chamadas, monitoramento, criptografia e testes completos de segurança.

O retorno numérico é **apenas o próximo número de lease**, não é confirmação do CRM. O endpoint, o worker, o consentimento jurídico, o lead e o destino real continuam inexistentes neste recorte. F70 (paridade do formulário legado) e os demais gates de staging, LGPD, segurança e lançamento permanecem bloqueados.

Sem dados reais, API pública, migração produtiva, acesso à VPS, merge em `main`, DNS ou despesa adicional.
