# Faísca R88 — bloquear na interface privada respostas sem vínculo de fonte

Base imutável: R87 #560 `9d72bc4531304b0339abbf3919cfee782610b9c5`. Branch/PR draft sobre a R87.

## Falha reproduzível
Após R87, o servidor passou a indicar `sourceRecipeBound: false` para fixtures antigas sem `schema`/`answerId`. Mas o navegador R79 ainda exibia essas respostas como geradas, bastando dois IDs de modelo e uma lista de fontes. A cadeia real R72/R87 já é capaz de fornecer uma prova mais estrita.

## Implementação
- `private-review-page.mjs`: para renderizar resposta em `textContent`, exigir `sourceRecipeBound === true`; 200 sem vínculo é falha visível neutra e não exibe prosa nem fontes.
- `private-review-browser-qa.mjs`: fixture positiva do navegador reproduz envelope real Luna+Terra com recipe e fontes R06; fixture negativa intercepta a resposta com dois modelos válidos mas `sourceRecipeBound:false` e verifica que a tela **não** apresenta a alegação, apaga o token e não efetua chamada extra.
- `tests/faisca-r88-private-browser-source-gate.test.mjs`: auditoria Node da condição e da compatibilidade HTTP herdada, marcada explicitamente como não verificada.

## Executar
```sh
node --test tests/faisca-r88-private-browser-source-gate.test.mjs
node ops/faisca/openai/private-review-browser-qa.mjs
```

O browser confia no host privado e não prova a fidelidade semântica do texto, nem o modelo efetivo de forma criptográfica. Requer CI completa na SHA exata e revisão independente AppSec/UX/editorial. Tests sintéticos, nunca GO público. `publicFaiscaEnabled=false`; sem alteração de site/mascote/main, sem merge, deploy, VPS/DNS, clientes reais, credenciais, API faturada, CRM/Portal operacional, lead, ticket ou cobrança.
