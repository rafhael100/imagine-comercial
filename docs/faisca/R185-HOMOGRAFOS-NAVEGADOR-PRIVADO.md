# R185 — prevenção de homógrafos antes do POST no navegador privado

A R184 mantém o bloqueio autoritativo no servidor. Nesta camada complementar, o navegador de revisão privada recusa letras Unicode de `Script` diferente de `Latin` em perguntas ficcionais em português. Isso bloqueia misturas com letras cirílicas ou gregas semelhantes a letras latinas **sem transliterar nem encaminhar** a pergunta.

A mesma lista de cinco exemplos fictícios da R184 é exercitada pelo QA Chromium: antes de cada envio, um interceptador de rede conta POSTs; as entradas devem ser recusadas com **zero POST e zero chamada ao adaptador**. A cada rejeição, token, pergunta e atestação são apagados. A R184 ainda verifica HTTP 400 diretamente, mesmo que o JavaScript do navegador seja contornado.

Comandos para revisão: `node --test tests/faisca-r184-mixed-script-preflight.test.mjs` e `node ops/faisca/openai/private-conversation-browser-qa.mjs`, além da CI integral na HEAD exata da PR. Essa política deliberadamente restritiva se aplica somente a perguntas fictícias privadas; não representa DLP ou defesa completa contra prompt injection.

Sem API paga, credenciais, dados reais, deploy, merge, alteração de VPS/DNS ou operações Portal/CRM/Sites. Testes pagos anteriores e homologação R92 relatada não foram refeitos; R95–R185 não são consideradas instaladas em staging. Preservados mascote aprovado, site público, `main` e `publicFaiscaEnabled=false`. **NO-GO público**.
