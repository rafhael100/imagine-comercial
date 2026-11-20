# Faísca R129 — barreira de saída independente na interface privada

## Problema
A validação HTTP Node da conversa sintética já rejeita contatos, URLs, números e alegações de serviços executados. A interface de navegador, porém, conferia estrutura/proveniência e exibiria um texto enganoso caso um adaptador HTTP local fosse substituído ou adulterado, mesmo preservando o formato JSON esperado.

## Mudança
- Gate **adicional de saída do navegador privado**, antes de atualizar `textContent`, rejeita URLs, emails, sequências numéricas compatíveis com contatos e frases explícitas de serviços ficticiamente concluídos, após normalização Unicode.
- Não envia novas chamadas, não habilita atendimento público e não mexe no contrato de origem do servidor. Em recusa, o operador recebe somente mensagem genérica, sem texto suspeito ou citações.
- Testes Node com JS real em VM e respostas HTTP sintéticas: negativos de URL, email, telefone Unicode, publicação de site e campanha ativada; controle positivo editorial genérico.
- A lógica é **defesa em profundidade**: não substitui política editorial, classificação de PII, revisão humana e controles host/ledger.

## Reproduzir
```sh
node --test tests/faisca-r129-private-browser-egress.test.mjs
npm test
```
CI da HEAD exata deve cobrir Node, HTTP, Chromium/axe, build/SEO, PHP/Portal e PostgreSQL descartável.

## Regras
Empilhado sobre R128 #603, sem alterar `main`, site ou mascote aprovado. `publicFaiscaEnabled=false`; R92 já homologada por relato do operador, não presumir R95–R129 instaladas na VPS. Proibido merge, deploy, DNS, VPS, chamadas pagas sem credenciais provisionadas, dados reais, operações CRM/Portal, leads, tickets e cobrança. GO público continua separado.
