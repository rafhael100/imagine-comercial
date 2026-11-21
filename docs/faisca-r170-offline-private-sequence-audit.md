# Faísca R170 — fechamento de ponta a ponta privado e sintético (REVIEW ONLY)

## Objetivo
Até R169, a sequência HTTP fictícia R166 e o operador offline R167–R169 tinham suites separadas. A R170 cria uma prova executável integrada, sem chamadas reais, para detectar regressões na passagem entre os dois subsistemas.

## Cenários
1. Inicia servidor HTTP **somente em loopback** com Luna e Terra simuladas, `store:false`, sem ferramentas.
2. Registra snapshot do ledger antes, executa sequência de teste com pergunta rejeitada seguida de uma pergunta positiva fictícia e registra o snapshot depois.
3. Grava `before.json`, `after.json` e `aggregate.json` somente em diretório temporário 0700, com arquivos 0600 e formatos exatos. O agregado é **construído pelo teste** a partir das chamadas simuladas, não representa dados OpenAI.
4. Executa a auditoria offline R169 e exige duas reservas, nenhuma chamada na rejeição e resultado `COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW`, sempre com flags de reconciliação e liberação falsas.
5. Altera o agregado numérico (contagem menor) e exige `BLOCKED_REQUEST_MISMATCH`, sem chamadas adicionais.
6. Simula HTTP 503 da Terra: preserva duas reservas, não repete chamadas, verifica auditoria offline e bloqueia custo acima da estimativa.

Comando: `node --test tests/faisca-r170-staging-offline-provider-audit.test.mjs`, além de `npm test` e CI completa na HEAD exata.

## Limites
O agregado é artificial e ainda pode ser falsificado em ambiente comprometido. O teste não estabelece origem da OpenAI, faturamento, integridade multi-host, revisão editorial real ou homologação do staging VPS. Não houve acesso operacional a chaves. As homologações manuais R92 anteriores permanecem respeitadas; R95+ e a conciliação independente ainda exigem operador.

Não autoriza main, merge, publicação, mudança DNS/VPS, dados reais, acionamento de CRM/Portal/Sites, leads, tickets ou cobrança. `publicFaiscaEnabled=false`, mascote e site público seguem intactos.
