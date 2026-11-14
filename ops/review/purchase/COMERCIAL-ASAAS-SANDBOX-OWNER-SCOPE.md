# P0 — Comercial → Portal assinado → fila Asaas Sandbox (sem chamadas reais)

## O que foi ligado

Esta PR sucede a Comercial #381. O checkout Astro em homologação CI gera links exatos para Onepage, Landing Page, Google Ads e Meta Ads, sem autenticação pública, valores de mídia ou cobrança. O navegador abre somente o destino loopback em CI e valida a mesma aplicação Laravel que a candidata Portal #761 (**SHA fixa** `3f7750daf4892050ae350b43d3f1e48f75023864`).

O Portal mantém HMAC por cliente e `FORCE ROW LEVEL SECURITY`, catálogo financeiro v4, orçamento versionado, componentes Asaas offline e verificação de aprovação/estorno. No banco **descartável**, a Landing Page originada do cartão Astro gera um pedido e uma intenção de cobrança Sandbox com valor exato **R$ 430,00**, calculado exclusivamente do snapshot revisado pelo servidor. O navegador tenta substituir `amount_cents` e recebe HTTP 422. Também verifica que nenhum usuário consegue aprovar manualmente o pagamento após optar pelo Sandbox, nem enviar briefing antes da confirmação.

No mesmo navegador, uma **segunda conta fictícia** entra no serviço Google Ads, confirma R$ 700 de mídia (pago ao canal, separado da Imagine) e registra uma intenção Sandbox de **R$ 140,00 em honorários**, calculados pelo Portal. O teste usa no máximo três ações de escrita sandbox por minuto (inclusive a tentativa de valor forjado), respeitando o limitador existente. A prova SQL compara os dois clientes com MACs verdadeiros e falsos; os testes independentes do worker com provedor **mockado**, inclusive `RECEIVED` e estorno `REFUNDED`, continuam validados na própria CI do Portal #761, não são reexecutados no mesmo navegador do Comercial. O ambiente de CI não faz requisições Asaas. Nenhum dado real, segredo, endpoint externo, e-mail/telefone ou credencial de PSP é utilizado.

## Teste adversarial criado neste repositório

`test-crossrepo-sandbox-owners.sql` consulta diretamente PostgreSQL18 com o login compartilhado `purchase_rehearsal_a` e exige **duas pessoas fictícias distintas, cada uma com uma intenção**, validando:

1. Sem principal assinado: nenhum registro visível; usuário/administrador forjado: nenhum registro visível.
2. Com HMAC real do primeiro cliente: apenas suas intenções; MAC reaproveitado com segundo cliente ou admin: nenhuma intenção.
3. Com HMAC real do segundo cliente: apenas suas intenções.
4. Sem `UPDATE` de valor ou confirmação de recebimento do provedor; não é possível assumir a role `purchase_rehearsal_psp` a partir do login web.
5. O restore de PostgreSQL18 precisa manter essas políticas e nenhuma consulta sem escopo pode enxergar dados.

A consulta do segredo HMAC existe **apenas** dentro do executor sintético controlado como administrador do banco para produzir testes positivos; a role web não recebe o segredo nem suas cópias. O workflow não imprime MACs, dados de clientes ou credenciais e apaga o banco ao concluir.

## Fora do escopo

Essa prova demonstra código, páginas e persistência PG18; não homologa contas Asaas, Pix/boletos, D30/D60/D90, worker host na VPS, chaves operacionais, IAM/MFA, contratos, nota fiscal, titularidade real, integração Sites, ledger de produção ou migrações persistentes. A checagem GET-only do Asaas também é mockada em CI.

**DRAFT / NO-GO / NO-MERGE / NO-DEPLOY / NO-CHARGE / NO-SITES-GRANT.** Manter endpoints e chaves desativados. Próximas etapas exigem homologação da identidade segregada do worker, auditoria de webhook/ledger e autorização operacional.
