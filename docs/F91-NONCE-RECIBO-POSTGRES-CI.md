# F91 — Nonce de recibo em PostgreSQL real descartável (Comercial × CRM F3-16)

## Objetivo
O contrato F90, compatível com o HMAC experimental do CRM F3-15, demonstra que a mesma assinatura pode passar duas vezes. A F91 acrescenta, somente no **PostgreSQL descartável do GitHub Actions**, uma barreira física de reutilização de nonce, preservando a separação entre **recibo de uma tentativa** e **submissão lógica idempotente**.

## Implementação
`tests/sql/lead-receipt-nonce-ephemeral.sql` cria, na fixture exclusiva `imagine_comercial_lead_ci`, quatro colunas de metadados: `organization_reference`, `nonce`, `submission_reference`, `observed_at`. A chave única é `PRIMARY KEY (organization_reference,nonce)` e uma FK exige que o identificador de submissão exista no ledger F85 da **mesma organização**. Não há nome, e-mail, telefone, mensagem, assinatura, segredo ou payload.

RLS é `FORCE`, com papéis de inserção `NOLOGIN/NOBYPASSRLS` herdados de F85 e políticas fixadas a dois UUIDs **fictícios**. O papel só pode fazer `SELECT/INSERT` nesta tabela; tentativas de alterar ou apagar marcadores são negadas. Um parâmetro `app.lab_tenant_id` informado na sessão não concede acesso a dados de outro tenant.

`scripts/test-lead-receipt-nonce-ephemeral-ci.sh` valida realmente no PostgreSQL local do runner:
1. **Duas conexões concorrentes** tentam gravar o mesmo nonce na mesma organização: exatamente uma ganha.
2. Replay idêntico não grava um segundo marcador; nonce já usado para outra submissão da mesma empresa também não substitui a referência original.
3. Uma **segunda tentativa com nonce diferente** para a mesma submissão pode criar outro marcador. O ledger F85 ainda possui **uma única submissão lógica**, demonstrando que nonce não substitui idempotência de negócio.
4. Outra empresa pode usar o mesmo nonce no seu escopo, sem ler o marcador da primeira. INSERT cross-tenant e falsificação de GUC falham.
5. Não se permite marcador para uma submissão inexistente; comandos UPDATE/DELETE/TRUNCATE pelo papel restrito falham.
6. A execução depende exclusivamente do banco `imagine_comercial_ci`, novo e descartável no GitHub-hosted CI F51; host externo, tabela preexistente e execução fora do runner são recusados. O banco é descartado ao final.

## Observações de segurança
Nonce e HMAC são controles diferentes. O verificador F90 não possui chave proveniente de serviço confiável, assinatura de payload nem comprovante de entrega. Um ledger de nonces **local** também não protege duas APIs/bancos independentes, não resolve tempos de resposta desconhecidos e não comprova entrega durável no CRM. O mecanismo deve ser combinado com autenticação de serviço, binding autorizado pelo Portal, idempotência definitiva no CRM, chave/rotação do KMS, conciliação após timeout, retenção e LGPD.

Esta é apenas prova de comportamento de PostgreSQL, **não** migração homologada. A versão operacional depende de SEG/DBA, revisão independente, ambientes isolados e comprovação do fluxo de orçamento do site antigo (gate F70). Nenhum dado pessoal real, endpoint, rede, worker, VPS, despesa, publicação, DNS ou merge `main` foi utilizado.
