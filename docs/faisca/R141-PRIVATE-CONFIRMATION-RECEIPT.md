# Faísca R141 — confirmação operacional host-owned no navegador privado

## Problema
O servidor R95 protege o status `needs_confirmation` por igualdade exata da resposta fixa: “Essa informação precisa ser confirmada com a equipe da Imagine.” O navegador, porém, apenas verificava estrutura, status, ausência de fontes e modelos; um adaptador local defeituoso que devolvesse HTTP 200 poderia apresentar texto comercial inventado como se a equipe tivesse confirmado uma condição.

## Implementação
- Centralização da mensagem autorizada em `PRIVATE_CONVERSATION_CONFIRMATION_TEXT`, exportada de `private-conversation-policy.mjs`.
- O HTTP continua exigindo igualdade exata; o navegador passa a conferir a mesma mensagem antes de qualquer renderização com `textContent`.
- Dois testes Node VM: confirmação legítima continua visível; confirmação falsificada, mesmo em envelope 200 válido, é rejeitada sem retry, com token apagado.
- Cenário Chromium real via interceptação HTTP sintética: mensagem falsa negada, mensagem exata aceita, zero chamadas adicionais ao provedor, nenhum dado real, token/textarea limpos. Os testes axe/WCAG existentes permanecem.
- Base R140 #616 isolada; a regressão LF da R139 #615 é tratada separadamente antes da validação acumulada.

## Gates e limites
Validar a HEAD desta PR no GitHub Actions para os seis workflows. Sem prova de publicação ou de implantação na VPS; R92 já reportada homologada pelo operador, R95+ não presumida instalada. Não há chave OpenAI autorizada no executor; estes testes usam fixtures sintéticas. Revisão independente AppSec/LGPD/editorial e staging privado acumulado continuam exigidos.

**NO-GO público.** Sem merge/deploy/VPS/DNS, operação CRM/Portal, checkout, leads, tickets, cobranças, dados reais ou chamadas pagas. Site, mascote, `main` e `publicFaiscaEnabled=false` intactos.
