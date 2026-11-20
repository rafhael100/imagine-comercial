# Faísca R142 — proteção editorial de respostas gerais no navegador privado

## Risco
A rota HTTP privada R95 valida `safePrivateGeneralReply`, impedindo que um texto da IA fale em nome da Imagine, cite ofertas/valores ou alegue execução. Porém o consumidor browser conferia apenas o esquema, modelos Luna+Terra, ausência de fontes, privacidade óbvia e garantias de resultado. Um adaptador HTTP local defeituoso poderia devolver HTTP 200 com uma afirmação comercial não fundamentada e renderizá-la como orientação geral.

## Correção
O JS da interface privada agora aplica proteção **independente** de afirmações da empresa, preços/condições financeiras e declarações em primeira pessoa de ações executadas em `general_answer`. As receitas `editorial_answer` permanecem estritamente vinculadas ao texto/IDs R06 da R139/R140; `needs_confirmation` permanece vinculado ao recibo exato R141.

Provas de laboratório:
- `node --test tests/faisca-r142-browser-general-egress.test.mjs`: HTTP 200 fictício com modelo e envelope aparentemente válidos, mas conteúdo comercial fabricado: rejeita sem retry, apaga token e pergunta e não exibe fontes.
- `node ops/faisca/openai/private-conversation-browser-qa.mjs`: Chrome real com `route.fulfill()` sintético, três negativos e uma resposta geral positiva; mantém axe/WCAG, viewport e nenhum acesso externo/provedor.
- Rodar todos os seis workflows da HEAD exata (Node/HTTP, Chromium, comercial/SEO, Onepage/Portal fixado, PHP e PostgreSQL descartável) antes de concluir.

Isto é uma barreira lexical conservadora, **não certifica veracidade semântica** e pode recusar frases legítimas no laboratório. Servidor autoritativo e revisão humana continuam obrigatórios. Sem usar dados reais, credenciais ou créditos da API. O usuário já concluiu R92; não presumir instalação R95+ na VPS, nem homologação do staging acumulado.

**NO-GO público:** preservar `main`, site público, mascote e `publicFaiscaEnabled=false`; sem merge, deploy, VPS/DNS, Portal/CRM operacional, lead/ticket/cobrança ou produção.
