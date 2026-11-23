# Faísca R273 — ciclo de vida HTTP obrigatório para ledger durável (DRAFT)

## Contrato

R271 #751 exige a presença da verificação final de segurança para adaptadores que declaram reservas locais duráveis. R272 #752 exige retorno estritamente `true`. Ainda era possível injetar um adaptador com cerca final mas sem os dois métodos essenciais de ciclo de vida:

- `acknowledgeHttpDelivery()`: confirma ao ledger que o HTTP terminou de ser escrito e permite a liberação conservadora do marcador;
- `markDeliveryUncertain()`: sinaliza entrega/percurso incerto, impedindo novo gasto até reconciliação.

**R273 rejeita a inicialização antes do bind TCP** se qualquer método estiver ausente em um adaptador com `localDurableReservations === true`. Repete a verificação imediatamente antes do HTTP 200, para rejeitar métodos removidos de um adaptador mutável depois do início.

O servidor ainda não pode tornar o `finish` e a liberação do marcador uma única operação atômica. O mecanismo de incerteza na falta de um método após o bind não prova persistência desse sinal; por isso o hook é exigido antes de abrir. Adaptadores sintéticos explicitamente não duráveis continuam compatíveis.

## Testes e gates

```sh
node --test tests/faisca-r273-durable-http-lifecycle-hooks.test.mjs
npm test
```

Testes Node/HTTP com adapter sintético, sem rede de provedor: recusa startup quando falta cada método, mantém 403 anônimo quando ambos existem e devolve 503 com bloqueio de novo envio se forem retirados após o bind. A R272 cobre o ledger real descartável, duas respostas Luna/Terra simuladas e a devolução negativa da cerca. Validar seis workflows na HEAD exata (incluindo Chromium/axe, SEO, PHP, PostgreSQL descartável e Portal/Onepage).

**Não concluído:** comprovação da R95 na VPS; vínculo imagem Docker → PID → porta → respostas HTTP; reconciliação financeira independente OpenAI; revisão AppSec/LGPD/FinOps/editorial. Sem dados reais, chave, chamada paga, CRM/Portal/Sites operacionais, merge, deploy, VPS/DNS ou alteração de site público. R92 e os testes reais manuais já relatados não foram repetidos. `main`, mascote e `publicFaiscaEnabled=false` preservados. **NO-GO público.**
