# F88 — Esgotamento de tentativas e revisão de filas de orçamento

## Objetivo
Complementar a F87 para que falhas repetidas de consumidores não causem **reenvio infinito**, confirmação falsa ou perda silenciosa do evento de outbox. A prova usa apenas metadados e dois tenants fictícios em PostgreSQL real **descartável do GitHub Actions**.

## Implementação
O arquivo `tests/sql/lead-outbox-exhaustion-review-ephemeral.sql` cria, somente na fixture de CI, a view `exhausted_claim_review` com `security_invoker=true` e `security_barrier=true`, retornando exclusivamente organização UUID, submissão UUID, versão e contagem de tentativas. A consulta indica apenas registros `claimed` com **três tentativas esgotadas** e lease já vencida; não altera a tabela, não libera envio e não declara conclusão.

A view usa **privilégios do consumidor que consulta** — não os do criador privilegiado — para manter as políticas RLS da tabela subjacente. Só papéis fictícios de consumidores A/B podem consultar. Não há autorização de INSERT, UPDATE ou DELETE pela view.

`scripts/test-lead-outbox-exhaustion-ephemeral-ci.sh` realiza a seguinte prova no banco descartável:
- Cria submissão e evento de revisão apenas com UUIDs fictícios.
- Simula três falhas consecutivas de processamento e a expiração da lease em cada rodada. O avanço de tempo é feito exclusivamente pelo operador privilegiado da fixture, não pelos papéis de consumidor.
- Exige que nenhum evento com lease ativa apareça como esgotado.
- Prova que a quarta tentativa não obtém uma nova reserva e que o estado permanece `claimed|3|3` até uma revisão administrativa **fora do escopo da fixture**.
- Consulta com a identidade A: exatamente um evento de revisão. Consulta com B: nenhum evento. Mesmo um parâmetro de sessão com o UUID de A não permite a B ler o registro.
- Recusa edição via view, leitura do ledger por papéis consumidores e finalização de evento com lease expirada.
- Não utiliza worker remoto, API, telefone, e-mail, nomes, banco persistente ou integração real com CRM.

## Limites de segurança e operação
A view é **um instrumento de teste**, não um sistema de observabilidade de produção. Em operação real, a triagem precisará de autorização independente, trilha auditável, política de reprocessamento/manual, alerta ao time responsável, retenção, backup, isolamento tenant efetivo, proteção antiabuso e conciliação com recibos de entrega válidos antes de decidir liberar retries. Nem `reconciled_lab` nem `exhausted_claim_review` significam que o CRM recebeu um pedido.

F87 e F88 **não resolvem o gate F70** da equivalência do formulário legado. A captação real só pode ser integrada após autenticação no Portal, consentimento verificável, proteção do endpoint, SLA/monitoramento homologados, teste de entrega real ao CRM e revisão SEG/DBA/LGPD. Nenhum deploy, `main`, DNS, uso da VPS, migração de produção ou custo adicional está autorizado nesta entrega.
