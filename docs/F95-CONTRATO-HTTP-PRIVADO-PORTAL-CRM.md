# F95 — Primeiro teste HTTP real de fronteira Comercial → Portal/CRM (somente loopback)

## O que é

Teste de contrato de comunicação **real**, mas restrito a `127.0.0.1` e ao processo de teste Node 22 do Imagine Comercial. `tests/fixtures/private-loopback-intake-harness.mjs` abre porta **aleatória** apenas no loopback e cria um segredo efêmero de 32 bytes para exercícios de autenticação de serviço. Não possui integração com o Portal existente, endpoint remoto, banco, client PII ou credenciais de produção. Não faz parte de nenhuma rota Astro compilada.

A rota `/__lab/internal/lead-review` **não é um caminho de API de produção** e somente existe durante o teste. Nunca publicar ou copiar esse código como receptor operacional.

## O que o CI deve validar

- Uma chamada HTTP `POST`, autenticada pelo **token sintético gerado em memória**, transporta somente o envelope de oito campos do CRM F3-11: protocolo, versão e seis UUIDs técnicos.
- O receptor de teste resolve localmente os identificadores de **organização, vínculo, site, formulário e destino**, independentemente de alegações do remetente. Alterações, mesmo com credencial de teste, devem retornar `403`.
- Método incorreto e rota com parâmetros retornam `404`. Falta de token ou token incorreto retorna `401`. `Content-Type` inesperado retorna `415`. JSON inválido retorna `400`. Campos extras, contato, consentimento, versão ou UUIDs incorretos retornam `422`. Corpo acima de 2 KiB retorna `413`.
- Duas chamadas HTTP concorrentes com `(organization,submission)` idênticos criam **uma única observação em memória**. O teste mostra diferença entre primeira observação e repetição.
- **Mesmo HTTP 202 não comprova entrega:** toda resposta carrega `mode:LAB_ONLY_VOLATILE_NO_CRM_DELIVERY` e `crmPersisted:false`, `tenantAuthenticatedForProduction:false`, `visitorAcknowledgementAllowed:false` e `deliveryProven:false`. Nenhuma resposta devolve UUIDs ou dados de contato.
- O servidor abre somente por chamada explícita dos testes, em `127.0.0.1:0`, e é fechado no final. Nenhum host externo, porta pública ou fetch de terceiros é utilizado. A fixture não entra em `src/pages`, `dist` ou no navegador visitante.

## O que ainda falta para produção

Este exercício cobre **comportamento HTTP de laboratório**, não um receptor com durabilidade. O conjunto guarda um Set efêmero, sem persistência após reinício; uma chave de teste não é uma identidade confiável. O tráfego loopback não testa HTTPS/TLS/mTLS, rate limit entre instâncias, antispam, consentimento com evidência legal, observabilidade, KMS, tolerância a partições ou a entrega real para CRM.

A integração operacional precisará de um endpoint apropriado do **Portal**, autenticado em seu papel de serviço para o **CRM**, com vínculos tenant/server aprovados, validação e criptografia de payload em ambiente privado, outbox persistente, antiabuso, idempotência final e consulta de recibos duráveis. Como a entrada pública de orçamento pode ser **anônima**, a segurança deve separar proteção de navegador contra abuso de autenticação entre servidores. Não impor MFA ao visitante sem uma decisão de produto.

O gate F70 permanece bloqueado. Nenhum formulário/endpoint público, dado pessoal real, DNS, VPS, deploy, gastos ou merge `main` foi executado.
