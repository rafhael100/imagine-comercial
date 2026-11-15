# F324 — cálculo informativo e contrato de escolha pré-cadastro

Status: **DRAFT / NO-MERGE / NO-DEPLOY / NO-CHARGE**.

## Problema resolvido

A vitrine F322/F323 já orienta o visitante a escolher primeiro, personalizar,
revisar e só então entrar com dados. A etapa seguinte exigia um contrato
determinístico para resumir o valor que *poderia* ser contratado, sem fazer do
Astro uma autoridade financeira e sem iniciar cadastro ao clicar.

O módulo `src/lib/commercial-selection-preview.mjs` aceita exclusivamente
um serviço revisado e, para Performance, os canais `google_ads` e/ou
`meta_ads`, com orçamento **inteiro em centavos**. Não aceita cliente,
redirecionamento, PSP, preço informado pelo navegador, cupom, senha, conta ou
identificação pessoal. Não faz rede, não persiste dados nem autoriza pagamento.

| Oferta | Implantação / ativação | Mensalidade / gestão |
| --- | --- | --- |
| Onepage | R$990 em 3× R$330 | R$79,90; 1ª em D+90 **da contratação** |
| Landing Page | R$1.290 em 3× R$430 | R$79,90; 1ª em D+90 **da contratação** |
| Google Ads | R$490 uma única vez | 20% da mídia efetiva, mínimo R$170 por mês/canal |
| Meta Ads | R$490 uma única vez | 20% da mídia efetiva, mínimo R$170 por mês/canal |

- **Piso de mídia para contratação:** Google R$1.000/mês; Meta R$700/mês.
- **Recomendado para planejamento:** Google R$1.500/mês; Meta R$1.000/mês.
- A mídia é paga diretamente às plataformas, **não** à Imagine.
- Gestão de Performance é apurada sobre mídia **efetivamente verificada**,
  após mês civil completo. O cálculo sobre mídia planejada é apenas simulação
  e **não pode** originar cobrança nem antecipar a mensalidade.
- ChatGPT Ads: estudo de elegibilidade e planejamento referencial (R$1.200
  mínimo e R$1.800 recomendado de mídia), **sem checkout habilitado**.
- Site completo e site por assinatura: valores dependem de proposta; **sem
  preço fictício** inserido no configurador.

## Proteções e cenários automatizados

`node --test tests/commercial-selection-preview.test.mjs` cobre preços,
parcelamento, pisos por canal, orçamento em centavos, gestão por canal,
independência entre mídias, R$490 por ativação, R$170 de mínimo,
R$800 sobre R$4.000, falsificações, itens desconhecidos e o estado
`realChargeEnabled=false`.

Nenhuma URL de checkout é construída a partir de dados do cliente.
O redirecionamento privado permitido continua no catálogo estrito
`ops/review/purchase/private-portal-handoff-policy.mjs`.
Os links são restritos ao ambiente privado controlado e não levam orçamento
ou preço por query string.

## Integração pendente com Portal

O Portal precisa validar novamente preços, itens, canal, limites, consentimento,
identidade, organização, sessão, proposta e meios de pagamento. Esta simulação
**não é fonte de verdade contratual**. Exibir a revisão do pedido deve anteceder
cadastro/login; confirmação de valores/contrato e eventual cobrança ocorrem
somente no Portal, após autenticação autorizada.

**Divergência histórica:** o contrato legado
`ops/review/purchase/PRIVATE-PORTAL-HANDOFF-CONTRACT.md` descreve piso
genérico de R$700 para ambos os canais. Não reutilizar essa regra para novos
pedidos Google. A revisão do Portal #823 prepara piso Google R$1.000 e Meta
R$700 no backend; homologar uma versão pinada e sua paridade antes de
permitir a compra real. O CI legado de handoff só demonstra um caminho
compatível com a versão anterior; não equivale a aprovação financeira.

Gates de liberação: testes CI na HEAD exata, revisão UX e segurança, paridade
do catálogo versionado/assinado do Portal, sessão e tenant isolados, consentimento
LGPD, contrato, antifraude, sandbox PSP, idempotência, backup/rollback e
homologação controlada na VPS. Nenhum merge ou publicação automática.
