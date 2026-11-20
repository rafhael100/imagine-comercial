# R106 — alegações falsas de execução no atendimento privado

**Status: DRAFT / LAB ONLY.** Base pinada: R105 #580, `b53306ae1ef2d8ff9e5302aa91660eda11d360ce`. Não houve publicação, merge, acesso ao Portal/CRM, alteração de VPS/DNS, chamada paga ou alteração do mascote.

## Falha reproduzível

A conversa livre R95 já proibia preço, PII, links, atribuição falsa a Imagine e determinadas operações comerciais. Entretanto, texto fictício de Terra como **“Já publiquei seu site e configurei seu domínio”** ou **“Seu site já está publicado”** podia passar pelo filtro de resposta geral. O servidor apresentaria uma afirmação incorreta de trabalho realizado, embora o laboratório não possua qualquer ferramenta ou autorização para realizar essas ações.

## Correção

`private-conversation-policy.mjs` passou a rejeitar três classes conservadoras: primeira pessoa afirmando execução (publicação, configuração, envio, integração, aprovação etc.); ativos do operador declarados prontos, publicados ou ativos; e recibos inventados de conclusão. Normaliza Unicode NFKD e diacríticos como a política existente. A mesma verificação `safePrivateGeneralReply()` é invocada pela saída direta de Terra **e** pela barreira independente HTTP, preservando o fallback exato de confirmação quando a resposta sintética falha.

`tests/faisca-r106-private-operational-claim-egress.test.mjs` cobre a política lexical, o HTTP loopback com provider injetado que tenta atribuir proveniência Luna/Terra falsa, o fluxo Luna/Terra sintético completo e respostas benignas de orientação geral. Não usa credenciais, tráfego pago ou PII reais. CI executa `node --test tests/faisca-*.test.mjs` e Chromium/axe já existentes.

## Limites e gates ainda fechados

Regex não comprova verdade, qualidade editorial, LGPD, nem detecta toda alegação de operação concluída; texto permitido continua sujeito a revisão humana. R92 relatada como homologada no passado **não** homologa R106. R95–R106 precisam de staging privado pinado, revisão independente de AppSec/editorial, prova operacional da quota/ledger e operador autorizado para eventuais chamadas pagas. Identidade/autoridade, contrato, aceite, recibos e checkout Onepage no Portal são requisitos externos não concluídos. `publicFaiscaEnabled=false` e site público permanecem inalterados; nenhuma entrega aqui habilita um chatbot público.
