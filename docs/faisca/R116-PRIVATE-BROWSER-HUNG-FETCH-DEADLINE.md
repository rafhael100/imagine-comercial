# Faísca R116 — deadline independente para fetch na interface privada

**Base imutável:** R115 #590 HEAD `04ad58963e620097c71aa0fd4ba32b910e9f3c81`, com 6/6 GitHub Actions aprovadas antes deste incremento. R95 #570 HEAD `91951653fca999f26595cc8113fbaff151225a89` também confirmou 6/6 na mesma consulta.

## Defeito confirmado por análise

A R109 limitou `reader.read()` com Promise.race e AbortSignal, mas o `await fetch(...)` inicial ainda dependia de cooperação da implementação HTTP. Um fetch travado, injetado ou não cooperativo pode ignorar `AbortController.abort()`: após os 35 s, a interface continua desabilitada e a referência transitória ao token permanece na closure da requisição pendente.

## Correção

A tela de revisão privada agora usa `fetchPrivateBeforeDeadline`, com corrida explícita contra o mesmo sinal de 35 s. O listener é removido em `finally`; nenhum retry é realizado. A proteção preserva o timeout de leitura R109, o limite de 16 KiB R90, `textContent`, proveniência Luna/Terra, vínculo editorial, CSP e token não persistente. A sessão HTTP privada mantém o breaker de conclusão incerta e prazo anterior a 35 s: recuperar o botão não significa liberar outra cobrança nem garantir que o provedor tenha cessado trabalho.

## Reprodução em laboratório

```bash
node --test tests/faisca-r116-private-browser-fetch-deadline.test.mjs
node --test tests/faisca-r109-private-browser-stream-abort.test.mjs
node --test tests/faisca-r90-private-browser-response-bounds.test.mjs
npm test
```

A nova fixture usa o **JS exato** servido ao navegador em uma VM com DOM mínimo, faz o fetch nunca resolver mesmo após abort, acelera somente o prazo de UI, verifica ausência de retry, apagamento do token, recuperação do botão, mensagem opaca e controle positivo de resposta editorial. CI Chromium/axe e smoke HTTP permanecem gates complementares; nenhuma chamada OpenAI real faz parte do teste.

## Gates restantes e restrições

- Requer CI completa na **HEAD exata desta PR**, com Node/HTTP, Chromium/axe, Comercial/SEO, Onepage/PHP/PG.
- Requer revisão AppSec/editorial independente, especialmente prazo do HTTP versus prazo da UI e comportamento em cenário de transporte ruim.
- Homologar o acumulado R95+ no staging privado **apenas por operador autorizado**, com SHA verificada e teste fictício. A R92 já foi relatada como homologada; não repetir nem afirmar instalação desta R116.
- Gate humano distinto para ativar Faísca no site comercial e conectá-lo a identidade, autoridade empresarial, contrato e recibos do Portal.

**NO-GO público:** manter `publicFaiscaEnabled=false`, mascote, `main` e site público intactos. Sem merge, deploy, DNS, VPS, credenciais, chamadas pagas, dados reais, operações CRM/Portal, leads, tickets ou cobrança.
