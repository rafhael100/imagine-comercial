# Faísca R252 — auditor HTTP privado em uma execução local

## Entrega

Novo entrypoint somente leitura combina as sondas existentes em uma execução atômica do ponto de vista de saída: 5 rotas canônicas (R240), 6 aliases/queries (R250) e 8 URIs codificadas/não canônicas (R251). Um erro em qualquer etapa produz apenas HOLD, nunca um relatório de aprovação parcial.

Execução somente após verificar checkout/pin independente e servidor privado local: `node ops/faisca/staging/run-private-http-full-review.mjs` ou `node ops/faisca/staging/run-private-http-full-review.mjs --port 4337`.

O alvo é exclusivamente IPv4 127.0.0.1, não aceita host, URL, rota, cabeçalhos ou credenciais via argumentos. Não faz login, não lê chaves, não dispara OpenAI, não envia dados de clientes. O JSON de sucesso fornece apenas contagem de 19 sondas, status de revisão local e flags de ausência de homologação/GO. Falhas não imprimem cabeçalhos nem corpo de resposta.

## Testes

`node --test tests/faisca-r252-combined-http-cli.test.mjs` executa subprocesso CLI contra servidor HTTP sintético, confirma 19 requisições sem Authorization/Cookie/Origin, recusa bypass em uma única rota codificada e entrada que tenta definir host/URL/portas inválidas.

## Limites

Uma resposta HTTP 401 local não prova que a porta da VPS não está exposta externamente. Também não comprova que o Nginx local corresponda a Docker inspect, digest assinado, staging operacional, uma conversa autenticada, uso/contabilidade OpenAI nem revisão LGPD. Para autorização de staging, comparar o pin independente do pacote/contêiner e revisar evidências de rede, aplicação, gastos e controles editoriais. Sem deploy/merge/VPS/DNS, sem GO público. Preservar `publicFaiscaEnabled=false`, main, mascote e site público.

Dependência: R251 PR #730, baseada em R250 PR #729. Teste pago Luna/Terra e homologação R92 relatados pelo usuário não foram repetidos. Sem dados reais, cobrança, leads, tickets ou operações CRM/Portal/Sites.
