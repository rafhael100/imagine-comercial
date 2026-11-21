# Faísca R160 — extrato somente leitura do ledger privado

## Finalidade

A R158 demonstrou duas reservas em um ledger descartável, mas a futura homologação do staging precisa de um **extrato local e não sensível** para comparação humana com o antes/depois da sequência fictícia R157 e com a fatura/uso do provedor obtidos separadamente por operador autorizado.

A R160 amplia `createFaiscaLocalReservationLedger` com `inspectReadOnly()`. Ela confere o diretório real privado, formatos canônicos, marca de inicialização, witness high-water e inexistência de lock aparente **antes e depois** da leitura. Retorna apenas: esquema, contagens de requisições, valor estimado reservado em micros de dólar, limites e flags explícitas de **não comprovação**. Não cria arquivos, locks, reservas, chamadas de IA, transações, logs de mensagens ou efeitos operacionais.

A leitura **não é atômica entre processos**, e outro processo pode reservar antes/depois da observação. Recomenda-se suspender as requisições enquanto o operador compara snapshots, e não tratar a diferença de contadores como atestado do provedor, compensação financeira ou ausência de chamadas invisíveis. A testemunha é local e não protege de comprometimento integral do host.

## Execução apenas pelo operador

Depois de verificar independentemente a HEAD e o ambiente privado, sem credenciais passadas ao script:

```bash
export FAISCA_PRIVATE_LEDGER_AUDIT_ACK=YES_LOCAL_READONLY_NO_PROVIDER_PROOF
export FAISCA_PRIVATE_LEDGER_DIRECTORY=/caminho/privado/ledger
export FAISCA_PRIVATE_LEDGER_MAX_REQUESTS=3
export FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD=1
node scripts/faisca-private-ledger-readonly-snapshot.mjs <SHA-de-40-caracteres-revisada>
```

Os valores 3 e 1 **são apenas exemplo de um laboratório fictício**. No staging, configurar os mesmos limites efetivos já provisionados no ledger, sem tentar redefini-los. A execução recusa CI, SHA incorreta, checkout sujo, diretório não privado, marcador/witness alterado e lock presente. Saída não inclui diretório, chave, token, texto, cliente ou resposta.

Testes executáveis sem credenciais ou rede externa:

```bash
node --test tests/faisca-r160-private-ledger-readonly-snapshot.test.mjs
node --test tests/faisca-r158-durable-model-sequence.test.mjs
```

## Pendências

O extrato deve ser confrontado **fora do GitHub público** com a contabilidade real do provedor, logs operacionais privados e eventual outro host. Não capturar nem publicar faturas, IDs de usuários ou chaves. Não presume R95–R160 instaladas na VPS, nem repete homologação R92 ou o teste pago anterior. Gate AppSec/LGPD/FinOps/editorial e staging do operador seguem pendentes.

`main`, site público, mascote e `publicFaiscaEnabled=false` mantidos. Sem alteração de DNS, VPS, merge, deploy, CRM/Portal/Sites operacionais, lead, ticket, cobrança ou GO público.
