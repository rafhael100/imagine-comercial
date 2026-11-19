# Faísca R56 — sincronização determinística de sessão HTTP no Chromium

**Base:** R55 draft #523; testes isolados do laboratório HTTP, `publicFaiscaEnabled=false`.

## Falha observada (19/11/2026)

O workflow de demonstração guiada da R55, na SHA `cd7b029c74c1b18b01ff80bf08a0f5ca230d718d`, falhou na **primeira** tentativa ao afirmar que a segunda sessão HTTP sintética foi capturada: `0 !== 1` no teste `two browser sessions cannot claim each other` de `ops/faisca/server/browser-qa.mjs`. O retry da mesma SHA, sem mudança funcional, passou. Isso sugere condição de corrida entre o DOM terminar de exibir o turno e o listener do Playwright consumir `response.json()`; não prova sozinho que o backend nunca falhe.

## Correção

- `ops/faisca/server/browser-qa.mjs`: `fixture.flush()` passa a aguardar **até 5 s** por todos os registros de sessão correspondente aos POSTs locais já observados e por todas as promessas de captura registradas. A captura não reenvia POST, não modifica o produto e **falha com mensagem objetiva** se a sessão continuar ausente.
- Conserva a verificação de identidades distintas, conflito de replay, e isolamento de sessões, bem como testes negativos do servidor.
- Não altera comportamento do navegador/servidor em produção, imagem, site público, dados reais, credenciais, Portal, CRM ou modelo externo.

## Testes e revisão

```sh
node --test tests/faisca-http-client.test.mjs tests/faisca-http-server.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/server/browser-qa.mjs
```

Revisar o workflow guiado na **HEAD exata R56**, inclusive casos de `unavailable`, `limit`, `timeout`, `malformed` e `transport_unknown`. Não reduzir assertivas nem classificar timeout como aprovação. Repetir teste de laboratório quando houver flutuação e investigar servidor apenas com evidência reproduzível.

**Gates inalterados:** R55 #523 e cadeia R07–R54 dependem de revisão independente; não fazer merge, deploy, DNS/VPS, ativação pública, contratação de provedores ou conexão real de leads, CRM, Portal e pagamentos.
