# P0 F159 — Fluxo de prévia de orçamento até inspeção do contrato CRM

Composição real (sem duplicar lógica) das classes F157 `assessPrivateBudgetPreview`, F78 `inspectSyntheticCrmEnvelopeV1`, F80 `inspectSyntheticCrmCasPrecondition` e F94 `reviewPortalCrmOperationalBoundary`.

Uma solicitação **inteiramente fictícia** percorre o formulário de sete controles visíveis, o envelope técnico de oito metadados e a avaliação de idempotência com versão. Os testes incluem versão obsoleta, resultado desconhecido, reserva concorrente, destino adulterado, consentimento forjado e campos pessoais inesperados no envelope.

**Não há captação nem integração produtiva:** resultado `ATOMIC_STORE_REQUIRED` significa justamente que não existe reserva persistida; código retornado nunca é ACK. Dados pessoais e UUIDs não saem no relatório. A empresa, vínculos, consentimento e assinaturas seguem não autenticados; bloqueios F70/F94, homologação do Portal/CRM, staging Leaseweb e revisão independente continuam vigentes.

Validação: `node --test tests/private-budget-crm-review.test.mjs` e `npm test`. Nada é publicado na `main` ou no domínio.
