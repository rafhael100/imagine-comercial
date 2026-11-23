# Faísca R293 — prazo absoluto para stdin da conciliação privada

**Base isolada:** R292 #772 HEAD `6473a608e1029b3e7610c14a0a55bc8f003c5594`. Sem alterações em `main`, site ou mascote.

O comando offline `scripts/faisca-private-usage-review.mjs` anteriormente podia aguardar indefinidamente um pipe que não emitisse EOF (vazio ou com JSON parcial), embora já limitasse seu tamanho a 256 bytes. Esta rodada adiciona um **prazo absoluto de três segundos** durante a leitura: um transmissor que mantenha o pipe aberto, mesmo enviando bytes intermitentemente, não pode prolongar a leitura. A expiração causa falha genérica, sem ecoar dados, caminhos ou conteúdo privado.

`node --test tests/faisca-r293-private-usage-stdin-deadline.test.mjs` verifica dois pipes sem EOF, com e sem JSON parcial, saída fechada e uniforme, término pela própria aplicação, e igualdade byte a byte do ledger antes/depois. Os testes R288–R292 preservam o caso positivo com agregado canônico e a rejeição de JSON ambíguo e uso em CI. Tudo usa números e mensagens sintéticos, sem API da OpenAI.

O prazo é uma proteção contra espera infinita, **não** prova de autenticidade das métricas, ausência de concorrência, instalação da R95 ou conciliação de faturamento. Não desbloqueia reservas, gasto, produção ou feature flag. Necessários: verificação independente do consumo oficial, auditorias AppSec/LGPD/FinOps/editorial, evidências diretas de Docker/PID/HTTP no staging e autorização futura separada para operações públicas. **NO-GO público.**
