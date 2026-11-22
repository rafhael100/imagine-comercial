# Faísca R224 — observações imutáveis do ledger privado

## Falha corrigida

O inspetor de ledger da sequência privada R157/R223 era uma função injetável. Se essa função reutilizasse e atualizasse **o mesmo objeto** em leituras sucessivas, os valores anteriores também mudavam por referência. A comparação do delta negativo podia então reconhecer erroneamente **zero** reservas, mesmo quando havia ocorrido reserva durável. Isso não implica que o inspetor de produção apresente o defeito, mas deixava a prova de staging vulnerável ao comportamento do adaptador.

## Controle

- Capturar imediatamente os nove campos exatos do esquema `faisca.private-ledger-readonly-snapshot.v1` em objeto novo e congelado.
- Rejeitar getters/accessors, propriedades simbólicas ou extras e números fora das faixas aprovadas.
- Comparar somente observações históricas imutáveis no preflight inicial, na verificação negativa, na checagem de capacidade, no erro positivo e no resultado positivo.
- Caso falhe leitura, esquema ou delta, retornar `BLOCKED_LEDGER_GATE`; nunca tentar novamente uma chamada, reembolsar reserva presumida ou avançar para a pergunta positiva.

## Evidência executável

`node --test tests/faisca-r224-immutable-ledger-observation.test.mjs`

Quatro testes: cópia histórica, rejeição de campos inseguros, resposta negativa HTTP adulterada com reserva durável escondida por objeto compartilhado, e controle sem alteração de custos. Os HTTPs são em loopback com token fictício; nenhuma chave ou chamada à OpenAI, dado real, ação CRM/Portal/Sites ou gasto.

## Limites e gates

A captura local não valida simultaneidade entre processos, proveniência real de chamadas da OpenAI, valores faturados, nem instalação da cadeia R95–R224 na VPS. Requer revisão AppSec/privacidade/FinOps/editorial e homologação operacional acumulada em staging privado com comprovação independente do operador. R92 e os testes pagos Luna/Terra anteriormente relatados não são repetidos. Nenhum GO público, alteração main, deploy ou DNS; `publicFaiscaEnabled=false` preservado.
