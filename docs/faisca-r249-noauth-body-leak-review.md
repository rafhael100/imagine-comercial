# Faísca R249 — inspeção do corpo HTTP 401 privado (sem credenciais)

## Problema
A sonda R240–R243 conferia status 401, cabeçalhos de autenticação/CSP e limites de tamanho/tempo, mas aceitava quaisquer até 8 KiB de **corpo** não autenticado. Assim, um erro 401 aparentemente válido poderia devolver por engano conteúdo privado, código ativo ou dados sensíveis e passar na revisão.

## Alteração
- A mesma sonda **somente loopback** e **sem Authorization/Cookie** passa a inspecionar os bytes do corpo de cada GET/HEAD antes de aprovar o resultado.
- Aplica limite de 2.048 bytes, UTF-8 fatal, proíbe marcações ativas (script, form, input, iframe, link, imagens, SVG), controles não imprimíveis, URLs, endereços/contatos, formatos de credencial e identificadores já reconhecidos pelo preflight privado.
- Se o servidor fornecer Content-Type, exige exatamente um cabeçalho com `text/html` ou `text/plain`, opcionalmente `charset=utf-8`; rejeita JSON, outros encodings e duplicatas.
- Erros falham fechados com a mensagem HOLD genérica da R240; jamais devolvem ou registram bytes do corpo.
- Preserva compatibilidade com a página 401 HTML padrão do Nginx e com os casos antigos, sem contatar endpoints externos.

## Execução
`node --test tests/faisca-r249-noauth-body-leak.test.mjs tests/faisca-r240-private-loopback-http.test.mjs tests/faisca-r241-loopback-absolute-deadline.test.mjs tests/faisca-r242-http-probe-cli.test.mjs tests/faisca-r243-noauth-active-response-headers.test.mjs`.

Verificar também os seis workflows CI da HEAD exata: Node/HTTP, Chromium/axe/WCAG, SEO/build, Portal/Onepage, PostgreSQL efêmero e PHP.

## Limites
Este detector conservador não garante ausência de toda PII, não valida conteúdo **autenticado**, não atesta Docker/imagem/identidade da VPS nem substitui AppSec/LGPD/FinOps/editorial. Não presume instalação de R95–R249. A homologação R92 e os testes pagos Luna/Terra já relatados não são repetidos.

**Base:** R248 #727 na SHA `5e5667f34da08621e4f471e07b0f7cf60fc02cad`. Exclusivamente laboratório e PR draft; nenhuma alteração de main, build público, mascote, `publicFaiscaEnabled=false`, VPS/DNS, Portal/Sites/CRM, merge, deploy, chaves, dados reais ou chamadas pagas. **NO-GO público.**
