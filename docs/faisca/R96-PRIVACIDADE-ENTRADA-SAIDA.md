# Faísca R96 — bloqueio de identificadores na entrada e saída privadas

**Base imutável:** R95 #570 em `91951653fca999f26595cc8113fbaff151225a89`, CI 6/6 SUCCESS. Branch isolada, PR draft empilhada sobre R95, sem alterar o chatbot público.

## Defeitos e correções

1. A validação de pergunta fictícia R95 verificava principalmente dígitos ASCII e formatos literais. Sequências de telefone/documento em formas Unicode de compatibilidade, espaçamentos e pontuação podiam atravessar essa barreira e alcançar o transporte pago apesar da confirmação de fictício. `private-identifier-risk.mjs` normaliza Unicode em memória antes do detector conservador (sem persistência/eco do conteúdo).
2. O endpoint `/converse` confiava exclusivamente na implementação injetada de `lab.answerPrivateConversation` para rejeitar entrada sensível. Agora o próprio host HTTP repete o preflight **antes** de chamar qualquer provider, inclusive o simulado.
3. Uma resposta fictícia de modelo com telefone, identificador, email ou palavras de credencial podia ser mostrada como orientação genérica. A saída passa pelo mesmo detector antes de sua serialização HTTP e recusa a exibição com resposta neutra 503.

Prova: `node --test tests/faisca-r96-private-identifier-boundary.test.mjs`, além da suíte integral `node --test tests/faisca-*.test.mjs` e Chromium/axe da R95. Os testes usam apenas fixtures locais com identificadores *inventados*.

## Limites e gates

Isto **não é DLP/LGPD completo**: nomes, endereços escritos por extenso, imagens, variações linguísticas e ataques semânticos podem escapar; falso positivo intencional bloqueia resposta em vez de divulgar. Revisão independente AppSec/LGPD e editorial ainda é obrigatória.

Antes de um novo teste pago no staging: verificar CI **na HEAD exata da R96**, SHA aprovada por canal independente, preflight e smoke com operador autorizado, ledger persistente de custos e requisições, somente loopback e perguntas inteiramente fictícias. A homologação R92 já relatada não comprova R95 ou R96 instaladas.

Sem merge, deploy, alteração de VPS/DNS, chaves no GitHub, dados reais, integração CRM/Portal/Sites, tickets, leads ou cobranças. Mascote, `main`, site público e `publicFaiscaEnabled=false` preservados. A decisão de publicar exige GO humano próprio.
