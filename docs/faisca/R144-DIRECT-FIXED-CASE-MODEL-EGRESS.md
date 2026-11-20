# Faísca R144 — bloquear alegações fabricadas antes do retorno do cliente Luna/Terra

## Achado
O servidor HTTP R106/R135 e o navegador R137/R142 já recusavam alegações inventadas de execução e resultados comerciais. Entretanto, `createFaiscaOpenAILiveLab().answer(caseId)`, usado em laboratório sem HTTP, só checava URLs, contatos, preços e dados identificadores. Um consumidor privado direto poderia receber uma declaração falsa de publicação ou resultados garantidos.

## Correção
O adaptador de respostas para os três cenários fixos agora reusa, antes de devolver a resposta, as políticas conservadoras `hasPrivateOperationalClaim` e `hasPrivateUnsupportedOutcomeGuarantee`. Respostas rejeitadas não são exibidas ao chamador, não fazem retry e não devolvem créditos de requisição já reservados. O fluxo de respostas gerais livres já utilizava `safePrivateGeneralReply` e permanece inalterado.

## Testes
- `node --test tests/faisca-r144-direct-model-egress.test.mjs`: fixtures determinísticas Luna/Terra via `fetchImpl`, quatro respostas maliciosas e resposta genérica segura. Confirma até duas chamadas, `store:false`, ausência de ferramentas, proveniência e `publicReady:false`.
- Executar os seis workflows da HEAD exata: Node/HTTP/Chromium/axe, Astro/SEO, Portal/PHP e PG efêmero. Não há chamadas externas nem credenciais reais no teste.

## Limitações
Barreira lexical, não comprovação semântica. Continua obrigatória revisão independente editorial/AppSec/LGPD e homologação acumulada em staging privado. R92 homologada pelo operador; R95–R144 não presumidas instaladas. A API paga só é permitida quando o executor efetivamente possuir ambiente privado credenciado, sem leitura/exportação de segredos. **DRAFT — NO-GO público.** Sem main/merge, deploy, VPS, DNS, lead/ticket, cobrança, Portal/CRM operacional. Site, mascote e `publicFaiscaEnabled=false` intactos.
