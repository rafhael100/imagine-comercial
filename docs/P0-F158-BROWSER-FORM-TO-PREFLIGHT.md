# P0 F158 — Prova de formulário HTML real ↔ preflight no Chromium

A suíte `scripts/browser-qa.mjs` passa a extrair **do formulário privado efetivamente renderizado** os nove campos avaliados pela F157. Confere no mesmo teste o mínimo estrutural aproximado do CRM, ausência de qualquer capacidade de envio, persistência, reconhecimento jurídico, antibot ou recibo e diagnósticos sem dados de contato.

Testes negativos mostram que email alterado ou ausência de confirmação da própria prévia são recusados. São usadas somente informações artificiais do navegador, sem request POST, sem acesso a rede, cookies ou storage; o botão público continua inexistente e o botão da prévia permanece desativado.

A prova roda pelo `npm run test:browser` existente, sem criar outra suíte isolada ou serviço. `npm test` continua cobrindo os invariantes da F157. **Não é** homologação do fluxo Portal/CRM, revisão LGPD, prova de captura, API ou release.
