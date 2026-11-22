# Faísca R243 — respostas 401 sem cabeçalhos de efeito ativo (DRAFT)

A auditoria privada R240–R242 já verifica cinco rotas em `127.0.0.1`, sem enviar credenciais, exigindo 401, desafio Basic e cabeçalhos de proteção. A R243 fecha uma lacuna: um servidor poderia retornar 401 corretamente e ainda induzir conexões externas por `Link`, `Refresh`, `Alt-Svc` ou endpoints de relatórios de navegador.

## Incremento

- Analisa nomes/valores em `rawHeaders`, sem depender do mapa normalizado pelo Node; rejeita `Server` duplicado, inclusive quando os dois valores são iguais, e continua permitindo `Server` ausente ou exatamente `nginx` uma única vez.
- Rejeita em qualquer rota de revisão 401: `Link`, `Refresh`, `Alt-Svc`, `Report-To`, `Reporting-Endpoints`, `NEL`, `Content-Security-Policy-Report-Only`, qualquer `Access-Control-*`, `Set-Cookie2`, `Clear-Site-Data`, `Content-Location`, `Content-Disposition`, `Content-Encoding` e `Trailer`.
- Mantém os controles prévios: status 401, `WWW-Authenticate`, CSP e demais headers exatos, resposta máxima, deadline absoluto, cinco métodos e paths fixos, somente loopback e **sem token/cookie**. Não faz chamadas à OpenAI nem abre navegador externo.
- `node --test tests/faisca-r243-noauth-active-response-headers.test.mjs` prova uma configuração sintética legítima e 18 mutações negativas.

## Limites de prova

Esta auditoria **não prova** que a VPS usa o kit revisto, que o Docker inspecionado é o processo em execução, que não existe porta pública nem que o corpo de uma resposta 401 esteja isento de todos os dados sigilosos. Também não testa a navegação autenticada, respostas pagas, gastos reais ou a revisão AppSec/LGPD/editorial. A execução da função deve permanecer em ambiente privado autorizado, sem credenciais. Nenhum CI autoriza merge, deploy, cobrança, lead ou atendimento público. Respeitam-se os testes Luna/Terra e R92 já relatados, sem repeti-los. Preservar `main`, mascote/site público e `publicFaiscaEnabled=false`; **NO-GO público**.
