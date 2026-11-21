# Faísca R174 — segunda verificação Git após ler as evidências privadas

**REVIEW ONLY / sem GO público.** Continuação da R173 #651, baseada na R172 #650.

## Risco

Uma checagem isolada de HEAD/index/status antes da leitura dos extratos não detecta necessariamente uma alteração normal de arquivo rastreado ocorrida **durante** a inspeção. Embora a R169 confira os arquivos JSON duas vezes, a própria CLI e os arquivos de código poderiam mudar entre o primeiro preflight Git e a emissão do relatório.

## Alteração

A CLI confere HEAD, `git status --porcelain --untracked-files=all` e `git ls-files -v -z` **antes e depois** da leitura. Reutiliza o /usr/bin/git e o ambiente mínimo da R172; a R173 continua bloqueando assume-unchanged e skip-worktree. Só imprime o relatório numérico, sem identificadores, se ambas as observações estiverem limpas, na SHA exata e com a mesma listagem NUL de entradas rastreadas. Caso contrário, imprime apenas mensagem fixa de bloqueio e não emite relatório. Nenhum arquivo Git é modificado intencionalmente.

A segunda leitura não equivale a transação atômica, medição de binários em memória, root of trust, atestado do host ou prova de origem OpenAI. Um atacante que altere e restaure arquivos entre observações pode escapar, assim como um comprometimento do sistema. Assinaturas SHA-256 dos três JSON continuam exigidas por canal independente.

## Execução de laboratório

```bash
node --test tests/faisca-r174-private-checkout-postread.test.mjs
node --test tests/faisca-r173-operator-git-index-proof.test.mjs
node --test tests/faisca-r172-private-operator-git-isolation.test.mjs
npm test
```

Teste Git Linux em diretório descartável detecta arquivo rastreado modificado entre observações; testes Node verificam entrada malformada, mudança de HEAD, index e status, e impedimento de imprimir relatório antes do segundo preflight. Não há chamadas OpenAI, credenciais, dados reais ou VPS.

## Gates pendentes

A conciliação real com origem independente OpenAI, homologação R95+ em staging privado e revisão AppSec/LGPD/FinOps/editorial continuam pendentes. Preservar R92 e os testes pagos anteriores como já executados pelo operador. `main`, site público, mascote e `publicFaiscaEnabled=false` permanecem inalterados. Nenhum merge, deploy, alteração VPS/DNS ou operação CRM/Portal/Sites é autorizado pela CI.
