# Faísca R279 — ACK negativo, NO-START real e reinicialização

**Base:** R278 #758, HEAD `1c4f40a230fe99b65f5721904ed26748baa063ab`. PR empilhada e isolada.

A R278 alterou a decisão do HTTP após a Promise do ACK: somente `true` confirma liberação. A R279 demonstra **a persistência real** da falha no ledger R82, além de verificar o fechamento do novo processo após uma reinicialização simulada.

## Experimento executável

```sh
node --test tests/faisca-r279-durable-http-ack-negative-restart.test.mjs
node --test tests/faisca-r278-durable-http-ack-result.test.mjs
npm test
```

O teste usa o endpoint R95 de conversa fictícia autenticada, a implementação verdadeira `createFaiscaOpenAILiveLab`, o ledger R82 em diretório temporário 0700 e um transporte de respostas Luna/Terra **inteiramente simulado**. Um adaptador de laboratório emite `acknowledgeHttpDelivery() => false` após a primeira resposta HTTP 200; a camada HTTP deve recusar a segunda com 503 e invocar o hook original de incerteza.

A verificação exige duas reservas preservadas, os dois marcadores duráveis `.faisca-provider-outcome-uncertain` e `.faisca-provider-dispatch-inflight`, nenhuma transcrição/chave sintética nos arquivos, bloqueio de `ready()` e **zero** chamadas em um novo processo usando o mesmo ledger. Confere também 403 anônimo, 400 para PII fictícia, ausência de CORS e ausência de eco de texto na falha.

## Escopo e limites

Não demonstra Atomicidade entre socket e fsync, recebimento pelo navegador, reconciliação contábil independente ou execução no Docker/VPS. Exige inspeção independente AppSec/LGPD/FinOps/editorial e prova operacional de imagem/processo/listener em staging privado. Homologação manual R92 e chamadas pagas anteriormente relatadas não são repetidas.

Sem credenciais reais, clientes, ações CRM/Portal/Sites, ticket, lead, checkout, cobranças, alterações VPS/DNS, merge ou deploy. Preservar `main`, o mascote e o site público, com `publicFaiscaEnabled=false`. **DRAFT / NO-GO público.**
