# Imagine Comercial — auditoria funcional e documentação reconciliada F322–F329
**Data de corte:** 15/11/2026. **Escopo:** vitrine comercial, conversão, internacionalização, orçamento, WhatsApp, simulação privada, handoff Comercial→Portal, mudanças visuais e testes.
**Status:** **EM REVISÃO / NO-MERGE / NO-DEPLOY / NO-CHARGE**. Esta documentação **não** autoriza merge de PRs empilhadas nem rollout. Um recurso descrito como "implementado" refere-se ao código da branch/PR indicada, e **não necessariamente a main ou produção**.

## 1. Fontes e trilhas de desenvolvimento (revisadas no GitHub)

| Entrega | PR | Escopo efetivamente implementado | Restrição |
|---|---|---|---|
| **F322** | [#404](https://github.com/rafhael100/imagine-comercial/pull/404) | Home PT com hero leve, ilustrações de 4 ofertas principais, 3 secundárias; copy curta e CTAs para escolha | Sem checkout público |
| **F323** | [#405](https://github.com/rafhael100/imagine-comercial/pull/405) | Home EN/ES com o mesmo artwork, copy, links WhatsApp curados e menu mobile; 7 ofertas acessíveis | Verificação SEO/WCAG por HEAD |
| **F324-A** | [#406](https://github.com/rafhael100/imagine-comercial/pull/406) | Motor de orçamento com valores aprovados em centavos e teste PHP de paridade com catálogo Portal V5 | Cálculo ilustrativo |
| **F324-B** | [#407](https://github.com/rafhael100/imagine-comercial/pull/407) | Simulador PT/EN/ES, site + canais Google/Meta, patamar mínimo/recomendado; mensagens de contato finitas e sem PII | Sem pedido, conta ou PSP |
| **F325-A** | [#408](https://github.com/rafhael100/imagine-comercial/pull/408) | Protótipo HTML navegável e independente, screenshots e teste offline de escolha→resumo | Prévia privada |
| **F325-B** | [#409](https://github.com/rafhael100/imagine-comercial/pull/409) | Em build **GitHub Actions privado**, gera URL de seleção de 3 enums para o Portal F426; público permanece WhatsApp | Não levar essa URL para produção |
| **F326** | [#410](https://github.com/rafhael100/imagine-comercial/pull/410) | Convergência de precificação do seletor com módulo editorial F324 e Portal PHP; evita dois catálogos divergentes | Ainda empilhada |
| **F327** | [#411](https://github.com/rafhael100/imagine-comercial/pull/411) | Gate legado conservador: seleção de um produto pode abrir prévia; combinações são bloqueadas para não perder itens | Precisa reconciliar com Portal F426 mais recente |
| **D01** | [#412](https://github.com/rafhael100/imagine-comercial/pull/412) | Navegação comercial renovada, bandeiras, logo, CTA de compra, três canais ilustrativos (inclui ChatGPT), demonstração privada e proposta de **3x** | Teste visual remoto pendente; autenticação Basic da VPS mantida |
| **F328** | [#413](https://github.com/rafhael100/imagine-comercial/pull/413) | Corrige QA Playwright da seção de mídia, que só aparece após escolher canal | Branch divergiu da D01 atualizada; não mesclar sem conciliação |
| **F329** | PR de auditoria atual | Documento transversal, cálculo exato dos centavos do 3x exibido, total explícito, recuperação da verificação F328 | Ainda não autoriza parcelamento real |

**Situação real em 15/11:** o commit D01 `4cf1615ad50298a0086d256a8895be11548f492b` já contém a copy 3x, ChatGPT Ads ilustrativo e a demonstração privada. A F328 `e58d40206ef154e9cda56b79c364ea4c5ece8c9e` foi criada sobre versão anterior da D01. A comparação GitHub informa **históricos divergentes**; não assumir que a F328 contenha copy, 3x, ChatGPT ou as últimas alterações da D01. Esta F329 parte da D01 atual e reintroduz o ajuste de QA F328.

## 2. Funcionalidades comerciais e identidade

- Visual aprovado: identidade Imagine com predominância da laranja `#F9941D`, cartões arejados, menus leves, ilustrações funcionais e texto objetivo.
- Site Onepage e Landing Page sempre legíveis para público não técnico; quatro ofertas de destaque, sem esconder as demais três no catálogo.
- PT/EN/ES: bandeiras 🇧🇷 🇺🇸 🇪🇸, menu responsivo, URLs e textos localizados; não converter bandeira em inferência de residência ou moeda do visitante.
- O visitante pode escolher antes do cadastro: site, canais de anúncios e, **somente se houver mídia**, patamar mínimo/recomendado. O CTA comercial público leva a contato **opt-in**; não coleta identidade silenciosamente.
- D01: navegação de simulação privada em `/simulacao/compra/` na VPS de **desenvolvimento** sob a autenticação Basic existente, com sessão/conta fictícias isoladas. Dados do checkout real do Portal, Asaas/C6 e CRM não são alimentados.
- Ilustrações, calculadora de mídia e respostas por serviço são recursos de marketing e planejamento, não autorizações de compra.
- Alterações visuais vistas em imagem/mockup **não bastam** para declarar código publicado, navegador revisado ou gateway habilitado.

## 3. Regras de orçamento — mesma moeda, rubricas diferentes

| Item | Valor em simulação | Regra |
|---|---:|---|
| Site Onepage | Implantação R$ 990,00 | 3 × R$ 330,00 no contrato individual vigente de homologação |
| Landing Page | Implantação R$ 1.290,00 | 3 × R$ 430,00 no contrato individual vigente |
| Mensalidade do site | R$ 79,90 | Primeiro vencimento em D+90 **da contratação**, mesmo sem publicação |
| Ativação Google Ads | R$ 490,00 | Rubrica única por canal, hoje **à vista no modelo de checkout Portal V5** |
| Ativação Meta Ads | R$ 490,00 | Mesma regra |
| Gestão de anúncios | máximo entre 20% do gasto **efetivo conferido** e R$ 170,00 | **Por canal/mês civil completo**; valor estimado a partir da mídia planejada não é fatura |
| Mídia Google mínima / recomendada | R$ 1.000 / R$ 1.500 por mês | Paga diretamente à plataforma |
| Mídia Meta mínima / recomendada | R$ 700 / R$ 1.000 por mês | Paga diretamente à plataforma |
| ChatGPT Ads, ilustrativo | Mídia em 30 dias: R$ 1.200 / R$ 1.800 | Somente exploração e simulação D01; **não** há compra operacional homologada ou disponibilidade universal garantida |
| Site completo / site por assinatura | Sob proposta | Não inventar preço padrão |

**Atenção: nova regra de UX de 15/11: "Implantação + ativações (3x sem juros)".**
O usuário aprovou a nova exibição e a D01 a introduziu no simulador comercial. A prévia D01 DEMO-V2 descreve 3 parcelas fictícias em D0/D30/D60 com `floor(total/3)` nas duas primeiras e diferença de centavos na última. O módulo de exibição F329 utiliza o mesmo cálculo, preservando `primeira + segunda + terceira = implantação + ativações`, e mostra também o **valor total**.
Exemplos informativos:
- Só Onepage: **R$ 990 = 3x R$ 330**;
- Só Google Ads: **R$ 490 = R$ 163,33 + R$ 163,33 + R$ 163,34**;
- Onepage + Google Ads: **R$ 1.480 = R$ 493,33 + R$ 493,33 + R$ 493,34**;
- Onepage + Google + Meta: **R$ 1.970 = R$ 656,66 + R$ 656,66 + R$ 656,68**;
- Landing + Google + Meta: **R$ 2.270 = R$ 756,66 + R$ 756,66 + R$ 756,68**.

**NÃO confundir a oferta comercial ilustrativa com o contrato financeiro do Portal.** O catálogo Portal V5 ainda precifica site parcelado (D0/D30/D60) e **ativação separada como exigível no primeiro aceite**. Para aplicar o novo 3x **às ativações reais**, são necessários: aceite financeiro e jurídico, versão nova do catálogo/contrato, tipo de pedido que represente os itens sem perda, validação do PSP em sandbox, calendários, conciliação, estornos, cancelamento, inadimplência, idempotência, RLS/tenant e backup/rollback. O resumo da D01 não altera essas políticas no Portal. Sem isso, **não** usar 3x como comprovante ou prometer cobrança operacional.

## 4. ChatGPT Ads: separar oferta de marketing de canal operativo

A D01 apresenta ChatGPT Ads como **terceira opção simulada**, inclusive combinada com Google/Meta. Ela utiliza valores editoriais de mídia e gestão. Isso não significa que o Portal F426 aceite `chatgpt_ads`: **o servidor o rejeita**, corretamente. Não converter silenciosamente ChatGPT para Google/Meta, não criar anúncio real, não assumir elegibilidade ou usar a simulação para gerar fatura. A disponibilidade comercial e API precisam ser verificadas e habilitadas em etapa própria.

## 5. Handoff Comercial → Portal: duas gerações coexistentes

- **F327/PR #411 (gate antigo):** apenas ofertas isoladas para link privado; bloqueia combinações para impedir perda de itens.
- **F325-B/PR #409 + Portal F426/PR #828 (gate novo, independente):** URL de homologação `/_preview/portal/shop?site=...&channels=...&tier=...` com **três enums**, sem preço, contato, token, tenant ou credencial. O Portal valida, recalcula V5, conserva a escolha após rotação da sessão e apresenta **site e Performance como aceites e pedidos separados**, não como carrinho único. Não há PSP de compra combinada.
- **D01/PR #412:** oferece demonstração **própria e fictícia**, não o checkout do Portal. A prova visual da simulação não é a prova de handoff/financeiro do Portal.

**Ação de integração pendente:** uma única branch de reconciliação técnica deve escolher o gate correto por modalidade e versão, executar a mesma matriz de seleções, assegurar não perda de itens, revisar a segurança cross-origin e só após isso preparar checkout real. O bloqueio F327 não deve ser desativado simplesmente porque o Portal F426 renderiza dois formulários separados. Manter a issue Portal [#830](https://github.com/rafhael100/imagine-portal/issues/830) para os critérios de compra agregada.

## 6. Estado de testes, VPS e evidências

- PR #407 HEAD `2aef835348869e6a949a7dec1762484dc58612be`: 6/6 workflows sucesso, incluindo Chromium e orçamento.
- PR #409 HEAD `8f1188dba274fffcb8ca5a13a36ed45e4690f40b`: 4/4 sucesso, incluindo build público vs. privado.
- PR #412 HEAD `4cf1615ad50298a0086d256a8895be11548f492b`: histórico mais recente inclui teste SEO/navegador **falho**; verificações de backend isoladas passaram. Não anunciar homologação visual integral da D01.
- PR #413: correção do teste condicional feita em branch divergente; F329 a reaplica sobre D01.
- A PR #412 informa implantação **somente de desenvolvimento** na VPS sob Basic auth, com cópias para rollback. O acesso pelo navegador de validação encontrou limitação de autenticação; o relatório desse PR **não** comprova QA visual final.
- Como cada branch tem sua HEAD e gatilhos próprios, só afirmar resultado **por SHA exata**. Nunca inferir CI verde de uma PR pai.

## 7. Matriz de aceitação para próxima liberação (ainda NO-GO)

- [ ] Harmonizar F327 antigo, F325-B novo, D01 demonstração e Portal F426 na mesma base revisada, sem substituir dados/rotas de produção;
- [ ] Auditoria de paridade de preços/parcelas PT/EN/ES, inclusive arredondamentos não divisíveis por 3 e ChatGPT Ads desabilitado no pedido;
- [ ] Revisão visual Chromium real (mobile 320/375, tablet, desktop), acessibilidade, contraste e navegação por teclado;
- [ ] Aprovação jurídico-financeira do **3x nas ativações**, atualização de catálogo e contratos antes de cobrança;
- [ ] Recalcular preços no Portal, assinar pedido real após autenticação/MFA/empresa, isolar tenant e exigir aceite por item;
- [ ] Homologar gateway escolhido (Asaas/C6), boleto/cartão/parcelas, calendário, retenção, conciliação, NFS-e, cancelamento, webhooks e rollback;
- [ ] Revisão independente SEG/DBA/LGPD, backup, restauração, testes de fraude/recusa/replay e GO manual de produção.

**Decisão operacional:** preservar DRAFT / NO-MERGE / NO-DEPLOY / NO-CHARGE; não introduzir URLs internas nem segredos no HTML público.
