# Imagine Comercial F327 — Portal handoff fail-closed por combinação

> **Nota de atualização (15/11/2026):** esta matriz permanece **histórica e vinculada à PR #411**, cujo destino privado admitia apenas **um produto**. A [PR Portal #828](https://github.com/rafhael100/imagine-portal/pull/828) implementou posteriormente, **em outra branch ainda DRAFT**, uma recepção de site + Google/Meta e uma tela com **dois pedidos separados** (não carrinho único). A [PR Comercial #409](https://github.com/rafhael100/imagine-comercial/pull/409) tem seu próprio contrato de handoff privado, não é sucessora automática de F327. Não retirar o bloqueio de F327 nem afirmar que #828 habilita checkout combinado sem reconciliação de branches e gates. Ver [auditoria F322–F329](COMERCIAL-AUDITORIA-FUNCIONAL-F322-F329-2026-11-15.md).

**Objetivo:** não encaminhar uma escolha combinada da vitrine PT/EN/ES para um endpoint do Portal que receba só um dos itens, o que resultaria em contratação parcial ou perda da seleção.

## Contrato seguro e suporte atual

O adaptador `ops/review/purchase/portal-choice-handoff-gate.mjs` verifica as escolhas já aprovadas pela F326, mas fica estritamente **em ops/CI**, não importado por páginas públicas.

| Escolha anônima | Destino privado permitido |
| --- | --- |
| Onepage sem anúncios | `product=onepage` |
| Landing sem anúncios | `product=landing-pages` |
| Somente Google Ads | `product=performance&channel=google_ads` |
| Somente Meta Ads | `product=performance&channel=meta_ads` |
| Google + Meta | **BLOQUEADO** até o Portal preservar ambos os canais |
| Site + qualquer mídia | **BLOQUEADO** até o Portal suportar carrinho multi-item |
| Sem seleção | **BLOQUEADO** |
| ChatGPT Ads | **BLOQUEADO**; elegibilidade/integração ainda em validação |

O teste enumera **24 cenários** de página, canais e faixas. Exatamente oito combinações (quatro ofertas em duas faixas) resultam em contexto privado único. Quatorze exigem contrato de carrinho; duas não têm seleção. O teste proíbe qualquer URL contendo verba, preço, cliente, login, tenant, redirecionamento, token ou tier. Valores devem ser recalculados e assinados pelo **Portal**, nunca extraídos da URL do marketing.

Mesmo nos quatro itens simples, a URL só é gerada se o processo for GitHub Actions com `IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW=1`. Nenhum redirecionamento automático público é incluído; a saída é revisão CI, não fluxo financeiro.

## Gatilho para integração real

Para concluir checkout combinado é necessário o Portal criar e validar uma intenção de compra assinada, com o escopo exato de itens/canais, origem, expiração, nonce, sessão/empresa/MFA, precificação server-owned, consentimento, isolamento de tenant, estoque de elegibilidade, aprovação e recuperação após login. Não enviar itens financeiros em query string, WhatsApp ou localStorage. Não habilitar antes de testes reais de reentrada, idempotência, RLS, aceite, cancelamento, PSP sandbox e ledger.

**NO-GO / NO-MERGE / NO-DEPLOY / NO-CHARGE / NO-ADS-WRITE**.
