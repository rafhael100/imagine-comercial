# R289 — rejeição de agregados ambíguos no CLI offline

**Base:** R288 #768 (HEAD `fd6279fc3bf3c5331f8d0c8698ff1f5888c7cbc2`). Entrega exclusivamente de laboratório em PR draft.

## Risco corrigido

O parser `JSON.parse` conserva silenciosamente o **último** campo repetido. Um agregado com `"requestCount":999,"requestCount":2` poderia ser interpretado pelo operador como contraditório enquanto a revisão R288 aceitava apenas o valor final, criando evidência de custo ambígua. Embora o comparador R287 nunca autorize despesas, desbloqueio ou publicação, o relatório financeiro também precisa recusar dados com representações conflitantes.

A entrada agora exige **JSON em bytes canônicos de `JSON.stringify`**, com no máximo um LF final (`printf '%s\n'`). Rejeita chaves repetidas, expoentes numéricos equivalentes, whitespace supérfluo, BOM, escapes alternativos e CRLF. A validação ocorre **antes de consultar** os arquivos do ledger.

## Testes executáveis

```sh
node --test tests/faisca-r287-private-usage-review.test.mjs \
  tests/faisca-r288-offline-usage-review-cli.test.mjs \
  tests/faisca-r289-canonical-usage-aggregate.test.mjs
```

O E2E cria apenas reservas fictícias fsynced em diretório descartável 0700; executa o subprocesso Node com pipe, confere a saída sem paths/credenciais/dados de usuário, rejeita nove variantes ambíguas e compara byte a byte os arquivos antes/depois. Toda divergência termina em **HOLD / revisão humana**, sem revelar entrada ou nomes de diretório.

Formato admitido:

```json
{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200}
```

Esses números **não são comprovantes da OpenAI**. O instrumento não valida recibos, não determina gastos oficiais, não resolve `NO-START`, não libera quotas ou fences, não acessa staging, não altera GitHub `main` e nunca habilita `publicFaiscaEnabled`. Conciliar consumo real requer verificação independente e revisão FinOps/AppSec/LGPD/editorial.

R92 e testes pagos privados já informados pelo operador foram respeitados, sem repetição. Sem credenciais, VPS, rede externa, deploy, merge, Portal/Sites operacionais, dados reais ou novas despesas.
