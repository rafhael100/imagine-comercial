# Faísca R227 — pins SHA-256 independentes imutáveis

A auditoria offline R171 exige três hashes esperados de fonte independente para `before.json`, `after.json` e `aggregate.json`. O código conferia a forma do objeto de hashes e depois lia o objeto novamente, durante as operações assíncronas de arquivo. Um inspetor com getter ou referência mutável poderia apresentar um valor no preflight e outro no instante da comparação.

**R227:** agora são capturadas uma única vez, antes de qualquer operação assíncrona de arquivo, exatamente três propriedades próprias, enumeráveis e de dados, contendo digests SHA-256 hexadecimais minúsculos. O snapshot fica congelado e todas as leituras de arquivo comparam apenas contra esse snapshot. Símbolos, campos ocultos, accessors, formatos incorretos e Proxy que lance erros são recusados sem expor detalhes.

Teste reproduzível em checkout isolado:

```bash
node --test tests/faisca-r227-independent-pin-snapshot.test.mjs
node --test tests/faisca-r171-independent-evidence-pins.test.mjs tests/faisca-r226-provider-aggregate-evidence-descriptors.test.mjs
```

Os novos testes criam três arquivos JSON sintéticos em diretório temporário de permissão 0700 e arquivos 0600, calculam hashes localmente e verificam troca do objeto após a chamada, getters jamais invocados, chaves ocultas, proxies hostis e recusa de digest divergente. Nenhum login, chave da OpenAI, mensagem real ou cobrança.

**Limites:** cópia imutável não atesta a origem de hashes, operador, fatura ou provedor. O caminho operacional em VPS e o staging cumulativo permanecem sem evidência direta; a reconciliação externa e revisões AppSec/LGPD/FinOps/editorial continuam bloqueios. `main`, site, mascote e `publicFaiscaEnabled=false` não foram alterados. Sem merge, deploy, DNS, VPS, CRM/Portal/Sites operacionais ou GO público.
