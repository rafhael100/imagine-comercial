# Faísca R154 — ensaio negativo de conversa privada em staging (operador)

## Objetivo e escopo

Depois da proteção R153 contra carga codificada, a homologação privada precisa de uma prova **HTTP real e limitada** de que o servidor em execução rejeita uma pergunta fictícia de risco **antes** de chegar ao modelo. Esta entrega disponibiliza um teste de verificação para ser executado somente pelo operador, no servidor de desenvolvimento já aprovado, através do loopback `127.0.0.1:4336`; **não instala nem configura** a VPS.

A função `inspectFaiscaPrivateNegativeConversation` valida primeiro os quatro ativos locais (HTML, JS, CSS e PNG original do mascote) por bytes/headers exatos usando o smoke R94. Apenas se todos passarem, emite **um único POST** autenticado com pergunta fixa fictícia que contém uma sequência base64-like. A resposta esperada é HTTP **400** com headers privados. Nunca envia dados reais, não faz retry, não chama o modelo diretamente, não decodifica conteúdo e não lê o corpo de resposta. O relatório contém somente contagens, códigos de avaliação e indicadores de segurança. O fato de receber 400 **não comprova, isoladamente, zero invocações do backend**: a inspeção do provedor e reservas duráveis permanece gate separado.

## Gates do operador

A CLI `node scripts/faisca-private-staging-negative-probe.mjs <SHA-REVISADA>` recusa CI/GitHub Actions, checkout sujo ou HEAD diferente da SHA obtida independentemente, e exige `FAISCA_PRIVATE_SYNTHETIC_CONVERSATION=YES_SYNTHETIC_ONLY`, `FAISCA_PRIVATE_NEGATIVE_PROBE_ACK=YES_ONE_SYNTHETIC_POST` e token dedicado provisionado privadamente em `FAISCA_REVIEW_BEARER_TOKEN`. Nunca usar a chave da OpenAI como token de revisão nem colocar ambos no repositório, log, URL ou issue. Execução somente por operador autorizado após teste read-only e confirmação de isolamento de rede e reservas.

## Provas em CI

O novo teste Node usa servidor real em loopback e fixture de modelo que falha caso seja invocada. Exercita entrada negativa HTTP 400, confirmação de zero chamadas da fixture, revisão exata dos ativos, bloqueio do POST em caso de JS adulterado, rejeição de token incorreto e reprovação de HTTP 200 forjado. O navegador Chromium/axe e o restante da cadeia continuam executados pelos seis workflows já existentes na HEAD exata.

## HOLD / NO-GO

R92 manual e chamadas Luna/Terra pagas já foram executadas pelo usuário e não devem ser repetidas sem motivo. R95–R154 **não têm instalação na VPS comprovada por esta PR**. O próximo passo depende de inspeção independente AppSec/LGPD/editorial e execução de homologação privada acumulada por operador com SHA pinada. Nenhuma publicação ou fluxo de cliente, merge em `main`, deploy, DNS/VPS, dado real, ação no CRM/Portal, lead, ticket ou cobrança está autorizado. Mascote, site público e `publicFaiscaEnabled=false` intactos.
