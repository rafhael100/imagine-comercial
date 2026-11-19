# Faísca R35 — integridade da entrada e IDs na cadeia R09 → R06

**Base:** Faísca R34 [#498](https://github.com/rafhael100/imagine-comercial/pull/498). **Escopo:** contrato interno do pipeline simulado, sem IA externa, dados reais ou alteração de comportamento público.

## Dois problemas encontrados

1. O pipeline R09 → R06 verificava as propriedades próprias de `{conversationId,messageId,userText}` com `Object.getOwnPropertyDescriptors`, mas depois relia `userText` diretamente. Um `Proxy` malicioso pode anunciar um descritor de valor e responder outro texto ao acesso `get`. O provedor poderia receber um turno diferente do objeto validado. Essa dupla leitura não é necessária.
2. O runtime R09 admite identificadores opacos de 1–64 caracteres, incluindo ponto, enquanto a requisição do R06 exige 8–96 caracteres formados apenas por letras, números, `_` ou `-`. Ao concatenar `_r06` ao `messageId`, IDs válidos no roteador — por exemplo `x` ou `r35.message.dot` — se tornavam inválidos para o PHP. Assim, a seleção editorial poderia passar pelo R09, mas a validação do R06 recusaria a fundamentação por motivo de transporte.

## Correções implementadas

Em `ops/faisca/model-router/grounded-pipeline.mjs`:

- A leitura de `conversationId`, `messageId` e `userText` usa **exclusivamente os valores dos descritores já inspecionados**. Não executa getters de dados brutos após o preflight. Entrada com getter próprio continua recusada; proxies com acesso `get` malicioso não conseguem trocar o valor encaminhado.
- Para preservar o histórico, o ID atual `messageId + '_r06'` continua sendo usado quando válido para a wire R06. Apenas quando inválido, o host cria um ID **determinístico e opaco** derivado do par `[conversationId,messageId]` por SHA-256, com prefixo `r06_` e 32 caracteres hexadecimais.
- A mesma função deriva o ID tanto em `send` quanto em `reconcile`, evitando duplo despacho de PHP por idempotência. O R06 continua validando texto/fonte antes de exibir resposta factual, e o provedor permanece exclusivamente `simulated`.

## Provas

`tests/faisca-r35-pipeline-input-integrity.test.mjs` testa:
- IDs `x`, `r35.message.dot`, um identificador convencional e um com 64 caracteres;
- fundamentação com o mesmo texto/citações, replay e conciliação idempotentes, com **um único despacho de PHP** por turno;
- Proxy que apresenta descritores próprios confiáveis e tenta retornar valor secreto via trap `get`; nenhuma leitura extra ocorre;
- Proxy que tenta substituir texto privado por pergunta comercial; nenhuma chamada é enviada;
- objeto com accessor próprio e ID inválido: ambos falham antes do roteador e do PHP.

O workflow Faísca roda essas regressões com as demais suítes, além da CI do Comercial, banco descartável, PHP R06 e Chromium. O aceite só vale para **a SHA exata da PR**, com revisão independente.

## Limites

Este fechamento é de **consistência de dados de entrada e transporte**. Não é garantia de DLP completo nem autorização para operar com visitantes reais. O Faísca continua em revisão privada, sem provedor de IA externo, orçamento real, checkout, Portal/CRM operacional, publicação ou alteração do mascote aprovado.

Não houve merge em `main`, DNS/VPS, cobrança, custos, credenciais ou dados pessoais.
