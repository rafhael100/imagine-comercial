# Faísca R95 — conversa privada fictícia integrada ao staging revisado

**Base selecionada:** R94 #569, SHA `fa145a106e2d3446b92680a06ee82bd0173fc85a`. A R94 incorpora R93 #568 e R92 #566, que o operador relata ter homologado recentemente na VPS. A R95 reconcilia os conceitos de pergunta fictícia livre da PR paralela R87 #567, **sem sobrescrever** as proteções de modelo (R86 #559), fonte editorial (R87 #560 e R88 #562), resposta do navegador (R90 #564), preflight obrigatório (R91 #565), controle financeiro (R93) ou integridade dos assets (R94).

## Entrega

- `FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY` habilita **somente no laboratório privado** um campo adicional para pergunta comercial **fictícia**, com confirmação expressa do operador. Sem a variável, os três cenários fixos funcionam como antes e o endpoint `/converse` devolve 404.
- `private-question-gate.mjs` rejeita parâmetros arbitrários, dados sensíveis e identificadores. `private-conversation-policy.mjs` separa dúvidas gerais de sites/marketing, preços/condições da Imagine e solicitações que precisam da equipe. A classificação e redação de conteúdo geral usam Luna + Terra; o material institucional exige texto editorial pinado ou resposta fixa de confirmação.
- `live-lab.mjs` mantém **verificação de modelo efetivamente informado pela API**, `store:false`, sem tools, respostas estruturadas, reserva durável de uso e limite de chamadas. O servidor privado continua obrigado a passar pelo preflight SHA/ledger/porta.
- O endpoint `/__faisca_openai_private/converse` aceita apenas POST autenticado pelo token de revisão, de origem loopback exata, com corpo JSON fechado `[true,"pergunta fictícia"]`, limite de 1.500 bytes, tempo de leitura finito, sem CORS, cookies, URL externa ou prompts arbitrários de clientes.
- Resposta geral do modelo não exibe fontes da Imagine. Resposta editorial de preço/processo deve corresponder **exatamente** à receita e à lista de fontes locais; afirmações inventadas ou inconsistentes retornam 503 sem eco. A interface só mostra conteúdo como `textContent`, com leitura máxima de 16 KiB, deadline de 35s, listas de fontes limitadas e token apagado.
- O smoke GET R94 mantém **comparação exata dos assets** também no modo opcional de conversa, sem consumir créditos.

## Provas e gates

```bash
node --test tests/faisca-r95-private-conversation-composition.test.mjs
node --test tests/faisca-*.test.mjs
node ops/faisca/openai/private-conversation-browser-qa.mjs
```

CI GitHub Actions deve concluir **6/6 workflows na HEAD final da R95**. Testes da CI usam somente respostas simuladas, nunca API key real, cliente real nem chamadas pagas. Antes do uso na VPS, revisar independemente AppSec, LGPD, FinOps e conteúdo editorial; confirmar SHA completa e checkout limpo. Esta PR não implanta nada sozinha.

## Roteiro do operador na VPS (somente depois da CI e revisão)

1. Preservar o checkout R92 e os processos existentes. Usar **outro checkout isolado da branch R95**, sem dar merge ou sobrescrever R92. Conferir a SHA final da PR em fonte independente.
2. Conferir Node >=22.12, `npm ci`, diretório privado 0700 de reservas **já existente** e ausência de processo conflitando com a porta `127.0.0.1:4336`. Não apagar estado/lock do ledger para obter nova cota.
3. Injetar `OPENAI_API_KEY` por shell privado/cofre, manter `FAISCA_REVIEW_BEARER_TOKEN` independente, `IMAGINE_FAISCA_OPENAI_LIVE_TEST=YES_PAY_SYNTHETIC_ONLY`, `FAISCA_PRIVATE_LEDGER_DIR` e `FAISCA_STAGING_REVIEW_SHA` igual à SHA final R95.
4. Habilitar a conversa somente no laboratório:
   ```bash
   export FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY
   node scripts/faisca-private-staging-preflight.mjs "$FAISCA_STAGING_REVIEW_SHA"
   ```
   Exigir `READY_FOR_PRIVATE_OPERATOR_START`; não iniciar se houver bloqueio.
5. Iniciar `node scripts/faisca-openai-private-review-server.mjs` no terminal privado. O serviço vincula **apenas 127.0.0.1:4336**, não cria DNS/Cloudflare/filtro público.
6. Em outra sessão na VPS (sem chave), executar `FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY node scripts/faisca-private-staging-readonly-smoke.mjs`. Exigir `PRIVATE_UI_READONLY_VERIFIED`. Em Windows, usar túnel SSH local para `4336` e abrir `http://127.0.0.1:4336/__faisca_openai_private/review`.
7. Para a primeira rodada, testar apenas perguntas **inteiramente fictícias** (ex.: `Vale a pena usar uma landing page para divulgar um evento?`; `Quanto a Imagine cobra por uma landing page?`). Não informar dados pessoais, telefones, emails, credenciais, notas fiscais, senhas, pedidos ou casos reais.
8. Registrar resultado técnico **sem segredos/texto sensível** e conferir custo efetivamente faturado no Usage da OpenAI. Encerrar o serviço e o túnel após o teste. Retirar as variáveis de segredo do shell.

## O que continua proibido

**Não é chatbot público**, não habilita `publicFaiscaEnabled`, não instala o mascote no site, não autoriza leads, tickets, contratos, checkout, pagamentos, CRM, Portal ou dados reais. As políticas lexicais não substituem uma solução de privacidade/LGPD robusta e os controles financeiros locais não equivalem a limite global de faturamento. A próxima aprovação para abrir o assistente aos visitantes dependerá de identidade, consentimento, orçamento distribuído, conteúdo, observabilidade, rollback e integração real com Portal/CRM, além de GO humano próprio.
