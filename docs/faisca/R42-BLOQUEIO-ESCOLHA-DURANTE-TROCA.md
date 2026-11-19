# Faísca R42 — impedir envio da escolha antiga durante uma troca de serviço

**Base:** [R41 #505](https://github.com/rafhael100/imagine-comercial/pull/505), candidata unificada F357/R39. **Escopo:** laboratório comercial privado e pacote portátil, sem checkout ou cliente real.

## Defeito funcional

A integração R37 permite clicar em **Levar escolha ao simulador** depois de concluir as cinco perguntas da qualificação R08. A sessão guarda um perfil anterior completo enquanto o visitante experimenta uma **troca de serviço**: fases `service_reselect` e `service_change_pending`.

O callback `quoteSite(session)` validava o perfil completo, mas não a fase. Assim, poderia continuar expondo `data-faisca-quote-site=onepage` durante uma troca pendente para Landing Page, dando ao usuário a impressão de que a escolha antiga ainda era a atual.

Também havia uma pequena janela durante o processamento assíncrono de uma nova ação: o DOM poderia conservar o atributo do turno anterior até a resposta ser conciliada.

## Correção

- `ops/faisca/journey/journey-ui.mjs`: função `getCompletedQuoteSite` autoriza a passagem **somente quando `session.phase === 'complete'` E o perfil R08 é confiável e completo**. Reabertura da seleção, mudança proposta e novos campos ainda não respondidos retornam `null`, sem apagar as escolhas anteriores da sessão.
- `ops/faisca/composition/quote-bridge.mjs`: exige que o log de conversa exista e esteja com `aria-busy=false` antes de aceitar o clique. Em resposta pendente, mantém o simulador como estava e apresenta orientação fixa, sem envio.
- `tests/faisca-r42-quote-handoff-state.test.mjs`: prova Onepage completo, reselect, confirmação pendente, cancelamento que restaura o serviço anterior, troca confirmada que reinicia a qualificação, serviço novo completo e perfil forjado.
- `ops/faisca/composition/browser-qa.mjs`: Chromium exercita o mesmo fluxo dentro da **homepage comercial real** em revisão privada, inclusive bloqueio por `aria-busy`, manutenção do simulador e reset.

## Comportamento desejado

- Onepage concluído: habilita passagem do **enum** após clique.
- Visitante começa a revisar a solução: **passagem desabilitada**, mesmo com perfil anterior válido armazenado.
- Visitante seleciona Landing Page, mas ainda não confirma: **passagem desabilitada**.
- Visitante cancela a troca: o perfil antigo continua válido e a passagem Onepage volta a ser permitida.
- Visitante confirma Landing Page: é uma qualificação nova e incompleta; passagem só retorna após as cinco perguntas.
- Durante uma resposta ou reset: nenhuma passagem de serviço.
- Conteúdo transferível continua **somente `onepage` ou `landing-pages`**, sem contato, respostas livres, plano, preço, token, pedido ou cobrança.

## Limites

A aplicação do serviço no simulador é uma escolha de **laboratório privado** feita pelo usuário. O DOM não é canal autenticado para pedidos e não pode conceder autoridade ao Portal ou PSP. O checkout público F348 continua desligado.

A CI precisa estar verde **na SHA final da R42** com Faísca, Comercial/SEO/Chromium, PHP, PostgreSQL descartável, contrato Portal pinado e Nginx R41. Nenhum merge em main, deploy, VPS/DNS, custo, cliente real, LLM externa ou alteração do mascote.
