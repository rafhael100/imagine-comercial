# Faísca R34 — intenção mínima compatível com pedido Onepage nativo do Portal

**Base:** Faísca R33 [#497](https://github.com/rafhael100/imagine-comercial/pull/497). **Fonte externa conferida:** Portal Onepage [#941](https://github.com/rafhael100/imagine-portal/pull/941), SHA `0e0ccc06755b6ddd938635e5c4c3625ff6497e2c`. Trabalho em PR draft, sem comunicação entre sistemas.

## Problema de integração real

O Portal já possui uma implementação nativa de pedido Onepage em Laravel com PostgreSQL, autenticação, MFA, isolamento por empresa, revisão de termos e validação de preço e contrato no servidor. Porém, o Faísca atualmente encerra a conversa com um **resumo apenas copiável**. A integração não pode converter o perfil de qualificação R08 em compra, enviar um contrato, presumir identidade do visitante ou trocar Landing Page por Onepage automaticamente.

A rota privada do Portal exige autenticação de negócio no servidor; para criar rascunho, o controlador recebe `request_key` e `selection`. A seleção permite apenas `site=onepage`, `channels=[]` e `tier=minimum|recommended`; o Portal precisa obter o comprador e a organização da própria sessão e validar o valor e a versão do catálogo. O Faísca **não pode escolher tier ou declarar aceite**.

## Entrega R34

`ops/faisca/qualification/portal-native-intent.mjs` implementa o contrato **`faisca.portal-onepage-intent.preview.v1`**. Recebe exclusivamente um **perfil R08 confiável e completo**, derivado de solução confirmada. Verifica que a política F348 do Comercial ainda impede checkout público e redirecionamento, antes de produzir qualquer orientação de compatibilidade.

O resultado é **apenas um registro em memória, sem envio**:

- Onepage: `status=onepage_intent_only`, `offerHint={site:"onepage"}`; o Portal ainda precisa autenticar, apresentar a seleção do plano, recalcular valores, mostrar termos e exigir aceite humano expresso.
- Landing Page: `status=native_onepage_not_supported`, `offerHint=null`, sem alterar a escolha do cliente nem tentar criar pedido no endpoint Onepage.
- Declarações constantes: `publicCheckoutAuthorized=false`, `portalLoginOrRedirectAuthorized=false`, `requestCreated=false`, `leadSent=false`, `orderCreated=false`, `paymentRequested=false`, `operationalEffects=false`.
- Não existem campos de empresa, tenant, comprador, telefone, e-mail, contato, consentimento, chave de idempotência, preço, tier, contrato ou token. O aviso de autorização de contato da qualificação não é interpretado como aceite jurídico ou permissão de pagar.

O contrato não constrói `POST`, URL, redirecionamento, webhook, armazenamento ou recibo. O snapshot de contrato nativo Portal é identificado pela SHA acima, **não** por uma branch móvel; se as interfaces do Portal evoluírem, revalidar antes de conectar um consumidor.

## Provas

`tests/faisca-r34-portal-native-intent.test.mjs` verifica Onepage e Landing Page, todos os estados de preferência de contato, perfil forjado ou incompleto, getters hostis e troca de serviço pendente, sem PII no resultado nem promessas de operação. A CI deve passar na SHA exata desta PR, incluindo todas as suítes R15–R33, PHP R06 pinado, Chromium e SEO Comercial.

## Próxima integração, condicionada

Quando o Portal estiver operacional em **staging HTTPS autenticado**, seu fluxo deverá receber a seleção *dentro de uma sessão do próprio Portal*, não confiar em dados do browser/Faísca para identidade. É necessário escolher explicitamente o tier, gerar `request_key` idempotente no contexto seguro, exigir revisão de termos/versionamento e concluir somente após recibo persistido e validado pelo servidor. Pagamento e encaminhamento ao Sites/CRM são gates adicionais.

O Portal #941 ainda relata transporte opcional desabilitado por padrão, PSP simulado, sem serving operacional e sem briefing de produção. A R34 não os presume.

**Sem merge em main, deploy, DNS, VPS, custo, credencial, dados de clientes, LLM externo, pagamento, CRM ou alteração do mascote.**
