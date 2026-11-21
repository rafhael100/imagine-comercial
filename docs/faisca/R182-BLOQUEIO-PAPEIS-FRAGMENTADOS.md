# Faísca R182 — bloqueio autoritativo de instruções fragmentadas (laboratório privado)

## Escopo

A R180 já negava instruções diretas de *system/developer*, substituição de políticas e extração de prompts. A R182 acrescenta verificação **somente de negação** para mensagens artificiais que fragmentam palavras com pontos, espaços, hífens ou separadores, e para cabeçalhos de papéis sintéticos como `[im_start]`, `[INST]` e chaves JSON `role=developer`. O filtro continua no servidor, antes do transporte Luna/Terra, e não modifica a pergunta, logs ou contabilização.

## Prova executável

`node --test tests/faisca-r182-obfuscated-role-boundary.test.mjs tests/faisca-r180-private-instruction-override.test.mjs`

Os fixtures são fictícios; o teste HTTP valida 400 sem eco e zero chamadas ao adaptador antes de aceitar uma pergunta legítima e responder sem efeitos operacionais. A CI `faisca-guided-lab.yml` também executa o conjunto `tests/faisca-*.test.mjs`, Chromium e axe/WCAG (sem API paga).

## Limites explícitos

Filtros lexicais são heurísticos, não certificam proteção completa contra prompt injection, consentimento, origem de fatos ou segurança de dados reais. R92 e chamadas pagas anteriores não são repetidas. R95 ainda exige homologação acumulada do operador em staging privado e revisões independentes AppSec, LGPD, FinOps e editorial. Sem chaves, rede operacional, VPS/DNS, `main`, merge, deploy, Portal/CRM/Sites operacionais, leads/tickets/cobranças ou GO público. `publicFaiscaEnabled=false`.
