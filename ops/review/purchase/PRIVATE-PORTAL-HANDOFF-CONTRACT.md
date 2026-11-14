# P0 — handoff Comercial → Portal com canal explícito

**Implementação atual exclusiva de CI e homologação privada**, sem publicação do site Astro nem preços calculados no Comercial.

O gerador `prepare-customer-portal.mjs` usa `private-portal-handoff-policy.mjs` para construir somente as seguintes URLs de prévia no host HTTPS `portal-dev.imaginecomunica.com.br`:

| Cartão no Comercial | Query de prévia privada |
| --- | --- |
| Onepage | `product=onepage` |
| Landing Page | `product=landing-pages` |
| Google Ads | `product=performance&channel=google_ads` |
| Meta Ads | `product=performance&channel=meta_ads` |

A PR do Portal [#746](https://github.com/rafhael100/imagine-portal/pull/746), empilhada sobre o checkout da PR #744, prepara o reconhecimento desse contexto após login/cadastro e sua exibição como aviso informativo. **O canal não seleciona orçamento, não fixa valores e não autoriza cobrança ou conta.** O Portal apresenta campos vazios para o cliente informar a verba de mídia e confirmar sua escolha; pode escolher também o segundo canal. O servidor calcula os honorários (20% da mídia, mínimo de investimento de R$ 700 por canal). Os anúncios são pagos pelo cliente diretamente ao Google/Meta; a gestão é separada.

A URL é montada somente pelo catálogo permitido; o Comercial não aceita redirect, IDs de clientes, preço, contrato, desconto, segredos ou quantidade por query. O gerador modifica uma cópia temporária do build em GitHub Actions e preserva o original e o hero. Testes verificam os quatro destinos exatos, desktop/mobile, segurança do host e parâmetros, e o manifesto NO-GO.

**Gates para operação real:** reconciliar branches de revisão e hashes de Portal/Comercial, homologar login e checkout na VPS privada, IAM/LGPD, Asaas sandbox e produção, eventos idempotentes, ledger, contratos, nota fiscal, provisão de Sites e plano de rollback. Não configurar DNS, produção, chaves ou cobrança nesta etapa.

**Status:** DRAFT / NO-GO / NO-MERGE / NO-DEPLOY / NO-CHARGE.
