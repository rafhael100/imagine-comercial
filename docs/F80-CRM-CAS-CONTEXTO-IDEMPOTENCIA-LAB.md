# F80 — Trava de contexto e pré-condições CAS de leads (Comercial ↔ CRM F3-12)

## Referências de código consultadas
CRM Imagine, branch `dev/f3-12-idempotency-cas-lab-2026-11-08`: `SyntheticIdempotencyClaim.php`, `SyntheticIdempotencyCasInspector.php`, `SyntheticIdempotencySnapshot.php` e `SyntheticIdempotencyPhase.php` em `app/Core/Leads`.

## Implementação
`src/lib/crm-idempotency-cas-parity-lab.mjs` interpreta SOMENTE o envelope técnico sintético F78 e o snapshot fictício (fase e versão), reproduzindo a ordem de precedência da proposta PHP do CRM:

1. **Escopo lógico:** `organization_reference` + `submission_reference` são a identidade da tentativa. Nunca usar e-mail/telefone ou texto para deduplicar.
2. **Contexto imutável:** `binding_reference`, `site_reference`, `form_reference` e `destination_reference` não podem mudar no mesmo escopo lógico.
3. **Concorrência:** versão esperada não negativa e coincidente com snapshot; divergência exige reconciliação. Operações diferentes de `reserve` são rejeitadas.
4. **Estados:** `reserved`, `outcome_unknown`, `delivered_claimed` e `expired_claimed` produzem códigos diagnósticos e não autorizam replay/reenvio automático.
5. **Aberto:** versão seguinte proposta apenas com `ATOMIC_STORE_REQUIRED`. Não existe reserva; duas verificações podem propor a mesma versão.

Todos os resultados têm `canCommitReservation:false`, `canRetryDelivery:false` e `canCreateLead:false`, nunca IDs ou payload. Validação de UUIDs é apenas sintática. O Node usa `Number.MAX_SAFE_INTEGER` como teto local, diferente do `PHP_INT_MAX`; não substitui o serviço PHP e exige alinhamento na especificação de integração.

## Verificações
`tests/crm-idempotency-cas-parity-lab.test.mjs` testa cross-tenant, troca de destino/site/form/vínculo, versões antigas ou inválidas, fases incertas, operação não prevista e entradas malformadas. O módulo não é importado pelo Astro público, não contém credenciais, fetch, API ou SQL.

## Limites e gates
Este exercício **não** implementa CAS atômico, transaction commit, persistência, outbox, assinatura, isolamento físico, comprovação de entrega, permissões de tenant, LGPD ou retry real. É obrigatório validar a API Portal/CRM no backend com testes PostgreSQL concorrentes e revisão independente antes da captação operacional. A F70 continua bloqueada; `main`, DNS e produção não foram alterados.

Esta entrega permanece em PR draft, sem dados reais nem novas despesas.
