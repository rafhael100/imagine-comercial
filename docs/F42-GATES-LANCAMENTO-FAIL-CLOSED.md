# F42 — Inventário de bloqueios de lançamento (fail-closed, somente revisão)

Um diagnóstico offline enumerado define os nove gates obrigatórios do Imagine Comercial: staging privado na VPS, autenticação/MFA/grants Portal, publicação com witness remoto, consentimento durável CRM, Search Console e crawl reais com análise de redirects, conteúdo/preços/identidade, instrumentos jurídicos/privacidade, validação de segurança/acessibilidade/performance de campo e aprovação explícita do proprietário.

A função `evaluateLaunchReadiness` não coleta evidências externas e **nunca concede deploy**. Mesmo com todas as entradas marcadas como `reviewed`, retorna `ALL_DECLARED_REVIEWED_NOT_AUTHORIZED`; entradas humanas são declarações não autenticadas, jamais prova real. Links GitHub são referências documentais, não certificação de que o gate foi concluído. Registros ausentes ou bloqueados permanecem pendentes. Esquema rígido rejeita gates inventados, status não previstos e URLs não permitidas.

Nenhum CI sintético fecha os gates. Um operador confiável precisa confirmar cada item em sistemas reais e uma autorização distinta deve preceder merge em main/DNS/Cloudflare/deploy. Não há deploy, mudança de produção nem dados pessoais nesta etapa.

Teste: `node --test tests/launch-readiness.test.mjs`.
