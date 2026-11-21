# Faísca R155 — prova positiva privada de conversa fictícia (composição R154)

## Objetivo

Complementar o smoke negativo R154 com uma prova positiva de **um único POST** contendo uma pergunta fixa e completamente fictícia, após conferir em HTTP os bytes e cabeçalhos dos quatro ativos privados R94/R154 (HTML, JavaScript, CSS, mascote aprovado). O novo teste verifica a forma completa da resposta de conversa: JSON, origem loopback, status HTTP 200, resposta geral conservadora, fontes vazias, ordem declarada Luna/Terra, revisão editorial obrigatória, sem publicReady ou efeitos operacionais.

O verificador não imprime nem persiste o texto da pergunta, da resposta, o token de acesso ou chaves; relata apenas resultado e contagens. Não existe retry. O corpo da resposta é limitado a 4096 bytes, com prazo absoluto e cancelamento em HTTP. Respostas forjadas com fatos comerciais, identificadores, fontes não aprovadas, proveniência truncada, JSON excessivo ou sinalização de prontidão pública são recusadas.

## Execução por operador autorizado (não executada nesta PR)

Somente **depois** de revisar SHA/checkout e confirmar staging privado já operacional, reservas duráveis e a inspeção dos registros da API, o operador poderá executar:

```bash
# Exigir variável FAISCA_REVIEW_BEARER_TOKEN previamente provisionada em ambiente privado
export FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY
export FAISCA_PRIVATE_POSITIVE_PROBE_ACK=YES_ONE_FICTIONAL_TWO_MODEL_CALLS
node scripts/faisca-private-staging-positive-probe.mjs <SHA-REVISTA-INDEPENDENTEMENTE>
```

A CLI bloqueia CI, checkout modificado, SHA divergente, origem externa, token inválido e ausência de autorização explícita. O código não acessa nem procura credenciais OpenAI. Uma execução contra servidor com Luna/Terra reais **pode gerar duas chamadas pagas**; só executar quando o próprio ambiente de desenvolvimento tiver credenciais seguras e autorização operacional expressa. Nunca usar dados reais, nem repetir a homologação R92 sem motivo.

## Testes em CI e limites da evidência

O teste Node inicia servidor HTTP real em loopback com laboratório **integralmente simulado**; confirma um POST, quatro GETs, conteúdo sintético aprovado e ausência de chamadas externas. Negativos testam ativo JS adulterado (zero POST), bearer incorreto (zero dispatch), preços/claims indevidos, identificadores, modelos inconsistentes, fontes falsas e corpo excessivo. A cadeia CI existente exercita também Chromium/axe, Portal/Onepage, PHP, PostgreSQL descartável e Comercial/SEO/build.

**A resposta com os IDs Luna/Terra não prova duas chamadas de modelo.** O relatório marca `modelCallsProvenExactlyTwo=false` e `providerTransportVerified=false` mesmo quando o envelope passa. O operador deve reconciliar o ledger de reservas/requisições e registros privados do provedor em gate separado. CI verde não equivale a homologação da VPS.

## Gates / NO-GO

- [ ] CI seis workflows na HEAD R155.
- [ ] Revisão independente AppSec, FinOps, LGPD e editorial.
- [ ] Homologação acumulada R95–R155 no staging privado por operador com SHA fixa, prova de isolamento e reconciliação de reservas/uso.
- [ ] Aprovação humana específica antes de qualquer publicação.

A homologação manual R92 e os testes pagos Luna/Terra anteriores foram respeitados. Nenhum deploy, merge, alteração de VPS/DNS, dado real, ação CRM/Portal/Sites, lead, ticket ou cobrança decorre desta mudança. Mascote, site público, `main` e `publicFaiscaEnabled=false` permanecem intocados.
