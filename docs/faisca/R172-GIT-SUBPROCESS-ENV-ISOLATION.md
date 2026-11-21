# Faísca R172 — isolamento de credenciais nos processos Git da auditoria

**REVIEW ONLY / sem GO público.** Base: R171 #649, que introduziu pins SHA-256 independentes para evidências numéricas privadas.

## Falha evitada

O comando privado de auditoria R167 executava `git rev-parse` e `git status` herdando todo o ambiente do operador, potencialmente incluindo `OPENAI_API_KEY`, `FAISCA_REVIEW_BEARER_TOKEN`, pins do comparador e opções `GIT_*` arbitrárias. Configurações locais de fsmonitor poderiam tentar iniciar processos auxiliares. **O Git não precisa receber qualquer um desses valores para conferir SHA e mudanças locais.**

A R172 executa somente `/usr/bin/git` (sem procurar binário pelo PATH), com argumentos em array, sem shell, e ambiente explicitamente limitado a seis opções técnicas não secretas: `LANG`, `LC_ALL`, `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL`, `GIT_OPTIONAL_LOCKS` e `GIT_TERMINAL_PROMPT`. Desabilita `core.fsmonitor`, hooks e untracked cache por parâmetros `-c`. Falta do binário no host causa bloqueio seguro; não há fallback inseguro. A auditoria privada é destinada a host Linux/POSIX autorizado. O processo pai ainda mantém credenciais no seu shell privado e nunca as imprime.

## Testes

```bash
node --test tests/faisca-r172-private-operator-git-isolation.test.mjs
node --test tests/faisca-r171-independent-evidence-pins.test.mjs
npm test
```

Testes com fixtures demonstram exclusão de segredos e overrides Git, execução do Git com ambiente mínimo, bloqueio do fsmonitor local e contrato de integração na CLI. A CI permanece sintética, sem uso de chave OpenAI nem rede para o provedor.

## Gates restantes

O isolamento de subprocesso não certifica a origem dos arquivos, a autenticidade da OpenAI, nem a revisão humana. Não houve execução na VPS nem instalação de R95–R172; manter R92 relatada pelo operador como concluída e não repetir testes pagos anteriores sem necessidade. Ainda pendentes conciliação independente com provedor, AppSec/LGPD/FinOps/editorial e homologação acumulada em staging privado. Preserve `main`, mascote, site público e `publicFaiscaEnabled=false`; sem deploy, DNS, merge, dados reais ou operação CRM/Portal/Sites.
