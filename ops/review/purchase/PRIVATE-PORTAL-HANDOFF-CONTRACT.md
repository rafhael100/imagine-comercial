# P0 — contrato estrito dos CTAs privados Comercial → Portal

Apenas o candidato de CI `prepare-customer-portal.mjs` monta URLs com a nova política `private-portal-handoff-policy.mjs`. Quatro identificadores de cartões são aceitos, direcionados ao Portal privado de homologação em HTTPS, com somente `product` e sem URL arbitrária fornecida pelo navegador.

| Cartão Comercial | SKU de teste do Portal |
| --- | --- |
| Onepage | `onepage` |
| Landing Page | `landing-pages` |
| Google Ads | `performance` |
| Meta Ads | `performance` |

**Limitação explícita:** Google Ads e Meta Ads ainda apontam ao mesmo SKU `performance`. Este handoff não identifica nem cobra automaticamente canais distintos. A regra comercial aprovada de Performance (20% da mídia, mídia mínima de R$ 700 por canal) deve ser aplicada somente pelo catálogo/checkout do Portal com identificação explícita de canais, antes de qualquer compromisso financeiro. Nunca inferir que os dois botões representam uma assinatura duplicada, nem inventar cobrança automática de dois canais.

O site Astro publicado, os dados e a origem financeira não foram alterados. O helper não aceita preço, cliente, token, desconto, retorno externo, webhook ou redirect como argumentos. Tests em `tests/private-portal-handoff-policy.test.mjs` recusam host, HTTP, fragmentos, parâmetros adicionais e produto desconhecido. Não há chamadas de rede, de PSP ou publicação.

**Release:** DRAFT / NO-GO / sem cobrança, sem merge e sem deploy. Antes de operação real, o Portal deve validar identidade, seleção de canais, consentimentos, preço assinado/versionado, recebimento Asaas reconciliado e provisionamento.
