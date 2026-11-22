# Faísca R242 — execução explícita da revisão HTTP local (DRAFT)

A sonda R240/R241 era uma função importável. A R242 acrescenta um CLI de leitura, permitindo repetir somente a prova negativa de autenticação **em loopback**, com saída resumida que não inclui corpos, cabeçalhos, identificadores, cookies ou credenciais.

## Uso privado, mediante autorização operacional separada

```sh
node ops/faisca/staging/run-private-http-boundary.mjs
```

O destino **não é configurável por URL ou hostname**: é sempre `127.0.0.1`, porta fixa `4337` do Compose revisado. A única opção aceita é `--port N` (inteiro decimal sem zeros à esquerda, 1 a 65535), destinada a servidores sintéticos locais em portas efêmeras. Não informar tokens ou segredos em argumentos. O CLI executa os cinco GET/HEAD fixos R240, aplica o deadline absoluto R241 de 2500ms por resposta e encerra com erro genérico em qualquer divergência. A saída JSON positiva tem as flags explícitas `operationalVpsIdentityVerified:false`, `authenticatedExperienceVerified:false`, `deploymentAuthorized:false` e `publicFaiscaEnabled:false`.

No CI, `node --test tests/faisca-r242-http-probe-cli.test.mjs` cria um servidor **sintético** 127.0.0.1:porta-efêmera, invoca o CLI em um processo Node separado e exige que não sejam transmitidos `Authorization`, `Cookie` ou `Origin`. Verifica também opções malformadas, URLs externas e indisponibilidade sem vazamento.

## Limites e gates

O CLI somente verifica a negativa HTTP local de um possível staging. Não prova que o contêiner inspecionado corresponde ao kit/digest revisado, que o processo rodou na VPS, que o serviço externo não está exposto, que há autenticação válida nem que as respostas Luna/Terra são corretas; também não verifica gastos ou revisões AppSec/LGPD/FinOps/editorial.

Os testes pagos Luna/Terra e a homologação R92 já relatados não foram repetidos. R95–R242 não são presumidos instalados na VPS. Nenhum deploy, merge, DNS, acesso a credenciais, cobrança, lead, ticket ou ação operacional Portal/Sites é autorizado por este artefato. `main`, mascote/site público e `publicFaiscaEnabled=false` devem permanecer inalterados. **NO-GO público.**
