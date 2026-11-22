# R219 — detalhes de tokens e recibo conservador do provedor

## Lacuna identificada
A R218 exige coerência entre `input_tokens`, `output_tokens` e `total_tokens`, mas os detalhes opcionais da API ainda podiam contradizer os totais: `cached_tokens` maior que a entrada ou `reasoning_tokens` maior que a saída. Um recibo assim não fornece base confiável para reconciliação dos gastos.

## Incremento
`receiveBoundedResponse()` verifica os campos presentes `usage.input_tokens_details.cached_tokens` e `usage.output_tokens_details.reasoning_tokens`. Cada contador deve ser um inteiro seguro, não negativo e não exceder o contador agregado correspondente. Objetos de detalhe presentes e nulos/inválidos são rejeitados. Detalhes ausentes e futuras chaves desconhecidas continuam aceitos por compatibilidade; não se presume que ausência significa gasto zero.

Uma contradição causa a mesma falha fechada já existente: HTTP 503 genérico, reserva durável mantida, marcação persistente de resultado incerto e nenhum retry. Se Luna falhar, Terra não é acionada. Não são gravadas perguntas, respostas nem identidades reais no ledger.

## Prova executável
`node --test tests/faisca-r219-provider-token-details.test.mjs` cobre o transporte Luna/Terra totalmente simulado, HTTP loopback com autenticação privada, ledger fsynced temporário, rejeições de valores maiores que o total, negativos e nulos, tentativa de reinício sem nova chamada e caminho positivo com ambos os modelos. A suíte regular `npm test` executa automaticamente o arquivo.

## Limites
Essa verificação identifica apenas inconsistências *internas* de um recibo declarado pela API. Ela não mede preço efetivo, não verifica a fatura nem constitui atestado independente da OpenAI. A R95 e a R92 não são consideradas instaladas por causa deste teste; exigem revisão e evidência operacional em staging privado acumulado. Nenhuma credencial, saída paga, cliente, CRM, Portal, Sites, lead, pedido ou cobrança é utilizado aqui.

**NO-GO público:** PR draft empilhada sobre R218 #697, sem merge, deploy, DNS ou alteração de VPS/main; mascote e site público preservados, `publicFaiscaEnabled=false`. Revisões AppSec/LGPD/FinOps/editorial e reconciliação independente permanecem pendentes.
