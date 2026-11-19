# R61 — mascaramento de texto livre em qualificação R08

**Status: DRAFT / laboratório; nenhuma publicação ou integração operacional.**
Base imutável: R60 [#532](https://github.com/rafhael100/imagine-comercial/pull/532), SHA `22970d58d7f395b4e09e8d7c77394f66c8c0a31f`.
Dependências: R59 #531 → SEC-01 #530 → R58 #528 → R57 #526 → R56 #525 → R55 #523 → R54 #522 → R53 #521 → R52 #520 → R51 #504. Não editar branches predecessoras.

## Falha reproduzível

Em `ops/faisca/qualification/journey.mjs`, a triagem de texto já utiliza opções fechadas quando reconhece uma resposta (R56). Entretanto, caso a mensagem não corresponda a uma opção, o fallback chama `respondJourney`, que pode retornar a mensagem original em `userText`. `ops/faisca/ui.mjs` exibe esse `userText` no log. A mesma exceção ocorria quando uma mensagem livre propunha a troca de Onepage para Landing Page. A heurística de dados sensíveis de `core.mjs` não deve ser confundida com filtro completo de dados pessoais.

## Correção

Após o processamento interno de texto livre não classificado na fase `qualification` ou `complete`, utilizar o marcador fixo `[Mensagem livre não registrada]` como eco visual. Aplicado também à proposta de troca pendente e ao fallback de resumo. As escolhas fechadas continuam mostrando o rótulo permitido. Não modificar o texto do visitante, não presumir consentimento, não gravar histórico, não enviar dados ou criar link Portal. Nenhuma mudança no site público, no mascote ou em `src/` e `public/`.

## Provas e revisão independente

- `node --test tests/faisca-r61-qualification-private-echo.test.mjs`: três cenários determinísticos com marcadores sintéticos (pergunta não reconhecida, troca ainda pendente e mensagem após conclusão). Exigem que o marcador não apareça na resposta serializada e que os estados/consentimento e preview R58 permaneçam corretos.
- `node --test tests/faisca-r56-qualification-safe-echo.test.mjs tests/faisca-r59-pending-service-guard.test.mjs tests/faisca-r60-qualification-state-invariants.test.mjs`: regressão adjacente.
- Executar `npm test`, Chromium/axe, QA HTTP loopback, compatibilidade Onepage Portal pinada, build Comercial/SEO e PostgreSQL efêmero na **SHA HEAD desta PR**. Não herdar CI da R60.
- Revisão independente deve confirmar que respostas de fallback nunca refletem dados livres no transcript (incluindo HTTP UI), que nenhum segredo entra em artifacts/telemetria, e que caminhos de apoio anônimo, escolha consentida, reinício e confirmação continuam intactos.
- Esta alteração só protege o eco exibido; ainda é necessário auditar dados transitórios em memória e caminhos de transporte local. Não constitui garantia de prevenção integral de vazamentos.

**NO-MERGE / NO-DEPLOY:** `publicFaiscaEnabled=false`; sem DNS, VPS, credenciais, clientes reais, LLM externo, CRM/Portal operacional, leads, tickets, pedidos ou cobrança. Para produção permanecem gates de autenticação, empresa/grants, consentimento, contrato/aceite, recibos, homologação privada e aprovação humana.
