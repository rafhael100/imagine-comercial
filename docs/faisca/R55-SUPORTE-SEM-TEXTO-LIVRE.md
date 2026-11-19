# Faísca R55 — triagem anônima sem campo de texto livre

**Base:** R54 #522 (draft) → R53 #521 → R52 #520 → R51 #504. Revisão **somente de laboratório**; não alterar main nem publicar.

## Motivação

O motor do suporte R10 somente aceita opções fechadas e descarta texto livre, mas a interface compartilhada ainda mostrava uma caixa de mensagem e um botão de enviar. O visitante poderia tentar digitar dados pessoais mesmo depois de instruções de privacidade.

## Mudança

- `ops/faisca/support/support-ui.mjs`: política local aprovada especifica `textInputEnabled: false`, sem recurso de entrada livre.
- `ops/faisca/ui.mjs`: valida o valor exato `false` por descritores de propriedade (sem acionar getters); oculta a caixa, desabilita entrada/envio, rejeita formulário disparado por script, limpa qualquer texto injetado, restaura foco na primeira opção fechada após cada resposta e após reinício. Ao desmontar, restitui os atributos originais. Os modos de vendedor e demais laboratórios mantêm o comportamento anterior.
- `ops/faisca/support/browser-qa.mjs`: verifica o campo inacessível, botões com foco, tentativa de submit forjado sem registro/envio, reset, 320/390/1440 px, axe, ausência de rede externa e storage.
- Continuam válidos os testes Node de R52 para payloads de texto forjado recebidos diretamente no motor; nenhuma identidade, texto livre ou ticket é persistido.

## Reproduzir e conferir

```sh
node --test tests/faisca-*.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/support/browser-qa.mjs
```

Revisar **CI na SHA exata da R55** e regressão do vendedor, keyboard, foco em botões substituídos, reset e axe; inspecionar diferença R54→R55 e política local. CI verde só significa ambiente de teste.

## Não autorizados

Não há cadastro, lead, login, ticket, CRM, Portal, cobrança, modelo externo, APIs, storage, autenticação, serviço real ou preço. `publicFaiscaEnabled=false`. Sem merge, deploy, DNS/VPS, dados pessoais, alteração do PNG aprovado ou mudanças no site público. Os gates independentes de R07–R10 e R51–R54 seguem abertos.
