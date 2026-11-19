# Faísca R86 — verificar identidade do modelo devolvida pela API

Base fixa: R85 #558 em `e48df3da89666bb27467e57fe367009809aab963`. DRAFT / PRIVATE LAB / NO-GO.

## Defeito reproduzível
O cliente R72 registrava `modelIds: [Luna, Terra]` após qualquer resposta HTTP 200 bem formada, sem conferir o campo `model` recebido no envelope da Responses API. A R83 verificava apenas os identificadores já carimbados pelo próprio cliente. Portanto, uma resposta de modelo incorreto ou sem identidade podia receber proveniência indevida.

## Correção
Em `receiveBoundedResponse`, exigir que `data.model` corresponda **exatamente** ao modelo solicitado nesta chamada (`gpt-6-luna` ou `gpt-6.1-terra`). Sem campo, alias divergente ou troca de modelo: falhar fechado antes do JSON editorial. Uma falha continua consumindo a reserva estimada, sem retry nem chamada subsequente ao Terra após erro Luna. Fixtures sintéticas das R72/R80/R81/R82 agora declaram os modelos explicitamente.

## Reproduzir
```sh
node --test tests/faisca-r86-openai-response-model.test.mjs
node --test tests/faisca-r72-openai-live-lab.test.mjs tests/faisca-r80-operator-live-question.test.mjs tests/faisca-r81-extended-paid-session.test.mjs tests/faisca-r81-private-http-extended-session.test.mjs tests/faisca-r82-durable-ledger.test.mjs
```

## Limites e revisão independente
A igualdade de IDs declarados em uma resposta HTTPS não é atestação criptográfica do modelo nem verificação editorial; é apenas conferência adicional contra descompasso. A API real pode retornar um identificador de versão diferente do alias solicitado: neste caso **não** afrouxar o gate sem documentação, contrato, teste privado autorizado e revisão humana. Nenhuma chamada API paga foi realizada nesta PR. Requer revisão AppSec/contrato da API, CI na HEAD exata, testes operacionais privados e gates Portal/Sites antes de publicação. Proibidos merge, deploy, DNS/VPS, credenciais, dados reais, leads/tickets, cobranças; `publicFaiscaEnabled=false`.
