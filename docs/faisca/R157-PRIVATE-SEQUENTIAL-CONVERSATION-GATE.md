# Faísca R157 — homologação sequencial de conversa fictícia privada

## Incremento implementado

R154 testa por HTTP a rejeição de uma entrada fictícia sensível antes do modelo. R155 testa um envelope positivo com orientação geral fictícia. A R157 impede que um teste positivo seja interpretado como aprovação quando o negativo falhou.

O orquestrador executa o smoke de quatro ativos privados exatos (HTML, JS, CSS e mascote), um POST negativo, e só após HTTP 400 com os cabeçalhos de privacidade exigidos faz nova verificação integral dos quatro ativos antes de um POST positivo. Se qualquer etapa falha, não envia pedidos seguintes. Máximo de oito GETs e dois POSTs, zero retries, sem texto real, operação comercial ou publicação.

O relatório contém contagens e estados, nunca bearer, pergunta ou resposta. IDs de modelos declarados no HTTP não provam chamadas pagas: os campos modelCallsProvenZeroForNegative, modelCallsProvenExactlyTwoForPositive, providerTransportVerified e ledgerReconciled ficam sempre falsos até conciliação independente.

## Gate do operador (não executado nesta PR)

Somente após revisão independente da SHA e confirmação de staging privado já operacional em loopback, reserva durável, token separado e controles da API previamente provisionados:

```bash
export FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY
export FAISCA_PRIVATE_SEQUENCE_ACK=YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS
# FAISCA_REVIEW_BEARER_TOKEN: provisionado de forma segura fora do GitHub
node scripts/faisca-private-staging-sequence.mjs <SHA-REVISTA-POR-CANAL-INDEPENDENTE>
```

A CLI rejeita CI, SHA divergente, arquivos modificados ou não rastreados e ausência de autorização explícita. O ensaio positivo pode gerar até duas chamadas pagas OpenAI. Não procurar, imprimir, exportar ou registrar chaves. Não repetir a homologação manual R92 nem testes pagos anteriores sem necessidade.

## Testes em CI

```bash
node --test tests/faisca-r157-private-staging-sequence.test.mjs
```

HTTP real com fixture local: ordem dos oito GETs e dois POSTs, ausência de dispatch da pergunta negativa, bloqueio total se JS adulterado, recusa de falso HTTP 200 no negativo, recusa de publicReady forjado no positivo, sem retries. Os demais gates Node, Chromium/axe, Onepage/Portal, PHP, PostgreSQL descartável e Comercial/SEO/build são herdados da CI.

**CI verde não comprova instalação da VPS, transporte do provedor, ledger reconciliado nem autorização pública.** A homologação acumulada R95–R157 exige execução privada por operador e revisão independente AppSec/LGPD/FinOps/editorial. Main, mascote, site público, publicFaiscaEnabled=false, DNS, VPS e integrações operacionais permanecem intactos.