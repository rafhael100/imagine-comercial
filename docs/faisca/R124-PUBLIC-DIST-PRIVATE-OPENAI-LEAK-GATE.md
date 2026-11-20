# Faísca R124 — impedir vazamento do laboratório OpenAI no build público

A R121–R123 evoluiu uma interface privada de conversa Luna/Terra e o PNG do mascote. O gate existente `auditPublicFaiscaDist` já barrava o PNG original pelo hash e os caminhos `/__faisca_preview/`, mas **não identificava** todos os endpoints e contratos específicos do laboratório `/__faisca_openai_private/`.

Esta entrega mantém `publicFaiscaEnabled=false` e adiciona bloqueios ao verificador de **build Astro público**, sem modificar páginas públicas nem ativar a interface de IA.

- Bloqueia qualquer diretório/arquivo público no prefixo `__faisca_openai_private`.
- Rejeita HTML, JS, CSS, JSON e outros artefatos textuais que incluam esse prefixo, contratos internos `faisca.openai-private-...-response.v1` ou nomes privados de configuração do token de revisão/ledger.
- Mantém proteção preexistente contra o PNG mestre pelo SHA-256 e contra artefatos do preview R24/R38.
- Testes sintéticos `node --test tests/faisca-r124-public-private-openai-leak-gate.test.mjs` criam um `dist` temporário e provam as negativas, além de aceitar uma referência editorial genérica a “Faísca” sem bloquear conteúdo legítimo.

**Limites:** um auditor lexical não impede todas as formas de vazamento de dados ou credenciais; não substitui revisão de segurança, inspeção do `dist` ou controles de publicação. O código é revisão de laboratório, sem GO público, e nenhuma validação prova a instalação da R95+ na VPS. Nada nesta entrega autoriza merge, deploy, DNS, operação no Portal/CRM, uso de chaves, créditos pagos, clientes, leads, tickets ou cobranças.
