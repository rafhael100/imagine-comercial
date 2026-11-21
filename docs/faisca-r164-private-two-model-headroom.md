# Faísca R164 — capacidade mínima antes da conversa positiva privada

## Motivo
Uma execução sequencial R157/R161 pode ter uma pergunta negativa corretamente rejeitada, mas descobrir tarde demais que o ledger só tem espaço para uma reserva. Isso permitiria iniciar Luna, consumir uma reserva e falhar antes de Terra, deixando uma tentativa parcialmente contabilizada e exigindo conciliação humana.

A R164 usa a fotografia R160 **após** a rejeição negativa para exigir pelo menos **duas vagas de requisição** e **dois micros de USD de saldo nominal** antes do único POST positivo. Se faltar capacidade, retorna `BLOCKED_LEDGER_CAPACITY` e não emite o POST positivo. O segundo piso serve apenas para detectar saldo **esgotado**, e NÃO prova suficiência econômica para os modelos: as estimativas reais de Luna e Terra continuam sendo cobradas em reserva atômica e verificadas em cada tentativa pelo adapter R72/R82. A observação local não é transacional; outro processo pode reservar depois dela.

## Testes
```bash
node --test tests/faisca-r164-two-model-headroom-gate.test.mjs
node --test tests/faisca-r163-failed-positive-reservation-audit.test.mjs
node --test tests/faisca-r162-audited-provider-fixture-sequence.test.mjs
```

O teste HTTP real em loopback usa apenas dados e saldo sintéticos: cria duas reservas anteriores de três permitidas, comprova a rejeição negativa e verifica que **nenhum POST positivo nem invocação do adapter** ocorre após a constatação da capacidade insuficiente. Também recusa estados inválidos e orçamento esgotado. A CI de PR verifica Node, Chromium/axe, integração HTTP, build/SEO, Portal/Onepage, PHP e PostgreSQL descartável.

Este incremento não revoga reservas existentes, não promete ausência de consumo do provedor, não concede GO público e não altera o site. O operador ainda precisa conferir requisições/reservas com o uso real do provedor. R92 e teste pago anterior são respeitados. Não se presume R95–R164 instalada na VPS; sem merge, deploy, credenciais, dados reais, CRM/Portal operacional, DNS ou cobrança. `main`, mascote e `publicFaiscaEnabled=false` preservados.
