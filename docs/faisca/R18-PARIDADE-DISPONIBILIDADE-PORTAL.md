# Faísca R18 — paridade com a disponibilidade de checkout do Imagine Comercial

**Base:** Faísca R17, PR #480. **Status:** laboratório em PR draft, sem integração de rede.  
**Fonte de autoridade pública:** `src/lib/public-portal-checkout-readiness.mjs` (F348).  
**Contrato:** `faisca.portal-readiness.preview.v1`.

## Por que esta etapa existe

O Faísca deve vender com clareza, mas não pode prometer que um cliente consegue pagar, assinar contrato ou acessar um carrinho quando o próprio Comercial ainda oferece apenas uma **prévia privada**. A plataforma comercial já possui um gate que declara `publicCheckoutAuthorized=false`, `portalLoginOrRedirectAuthorized=false` e `finalServerRepricingRequired=true`.

Criar um texto paralelo no Faísca geraria divergência: o visitante poderia ouvir uma promessa no chat e outra no simulador do site.

## Implementação

`ops/faisca/qualification/portal-readiness.mjs` consulta diretamente as funções F348 existentes, usando apenas o perfil enumerado e confiável da R08. A tradução de serviços é restrita:
- Onepage → `onepage`;
- Landing Page → `landing-pages`.

A função só retorna um status quando a qualificação foi concluída. Ela invoca o contrato comercial com canais vazios, sem preço selecionado, cadastro, tenant, identidade, token ou URL; o tier técnico `minimum` não é convertido em cotação ou compromisso.

O retorno descreve o status atual `private_single_preview_only` e declara explicitamente **nenhum checkout público, link de login/redirect, pedido, pagamento ou efeito operacional**. Se o contrato F348 evoluir para autorizar qualquer operação, o adaptador do Faísca **falha fechado** até uma nova revisão.

O texto **Como avançar?** da R17 passou a incorporar a mesma orientação editorial de indisponibilidade de checkout público, sem duplicar condições financeiras no Faísca.

## Testes

`tests/faisca-r18-portal-readiness.test.mjs` verifica:
1. Paridade exata com F348 nas duas soluções.
2. Ausência de URL de checkout, valores, cliente, token e custos.
3. Perfis forjados/incompletos e getters hostis recusados.
4. Nenhuma autorização por preferência de contato, seja positiva, negativa ou adiada.
5. Mensagem de indisponibilidade em Chromium, com PHP real reservado às respostas editoriais R06.

Executar em checkout isolado:

```bash
node --test tests/faisca-r18-portal-readiness.test.mjs tests/faisca-r17-next-step.test.mjs
npm test
```

A CI específica do GitHub precisa estar verde **na SHA desta PR**.

## Bloqueio para venda operacional

Os pedidos ainda pertencem ao **Portal**, não ao Faísca. A [issue Portal #669](https://github.com/rafhael100/imagine-portal/issues/669) exige backend real de homologação para salvar pedido/briefing; a [issue #830](https://github.com/rafhael100/imagine-portal/issues/830) exige carrinho seguro com seleção preservada. A ligação de checkout depende do catálogo e preços server-owned, autenticação/organização no Portal, contratos, pagamentos, revisão AppSec/LGPD, backup/restore e aprovação de GO. Um teste offline não supre esses gates.

**Não houve merge, implantação, alterações no mascote, DNS, Cloudflare, VPS, credenciais, fornecedores, clientes reais, dados financeiros ou cobrança.**
